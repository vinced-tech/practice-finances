// Credit-card statement import.
// Expected columns: Transaction Date, Post Date, Description, Category, Type, Amount
//
// Rules:
//  • Transaction Date decides the month AND year (a 12/31/2025 purchase posted 1/1/2026 is 2025).
//  • "Sale" rows are expenses. "Return" rows are refunds that reduce their category.
//  • Other types (e.g. "Payment" toward the card balance) are skipped — they aren't spending.
//  • A row already imported (same date, description and amount) is a duplicate.
//    Matching is count-based, so two genuine $2.99 charges on the same day are both kept
//    the first time, and both recognised as duplicates if the same file is imported again.

import { parseCSV } from './csv';
import { parseDate } from './dates';
import { merchantKey } from './merchant';
import type { AppState, Expense } from './model';
import { newId, OTHER_CATEGORY_ID } from './model';
import { parseCents } from './money';

export interface PreviewRow {
  /** position in the file (1 = first data row), for display */
  line: number;
  date: string;
  description: string;
  merchantKey: string;
  kind: 'expense' | 'refund';
  amountCents: number; // positive
  cardCategory: string;
  categoryId: string;
  personal: boolean;
  /** what the app suggested, so we can tell when the user corrected it */
  suggestedCategoryId: string;
  suggestedPersonal: boolean;
  status: 'new' | 'duplicate';
  include: boolean;
}

export interface SkippedRow {
  line: number;
  description: string;
  reason: string;
}

export interface ImportPreview {
  rows: PreviewRow[];
  skipped: SkippedRow[];
  /** Problems that stop the file being read at all (e.g. missing columns). */
  error?: string;
}

const COLS = {
  date: ['transaction date', 'trans date', 'date'],
  description: ['description', 'merchant', 'payee'],
  category: ['category'],
  type: ['type'],
  amount: ['amount'],
};

function findCol(header: string[], names: string[]): number {
  const h = header.map((x) => x.trim().toLowerCase());
  for (const n of names) {
    const i = h.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

// Words in the description that point to a therapy-practice category.
const KEYWORD_HINTS: [RegExp, string][] = [
  [/INSURANC|LIABILITY|HPSO|\bCPH\b/, 'insurance'],
  [/SECRETARY OF STA|IDFPR|LICENS|CAQH|\bNBCC\b/, 'licensing-and-fees'],
  [/OFFICE ALLY|AVAILITY|CLAIM|CLEARINGHOUSE|WAYSTAR/, 'billing-and-claims'],
  [/PSYCHOLOGY ?TODAY|GOOGLE \*?ADS|NETWORK ?SOLUTIONS|SQUARESPACE|\bWIX\b|GODADDY|VISTAPRINT/, 'marketing-and-website'],
  [/SIMPLEPRACTICE|THERAPYNOTES|THERANEST|ZOOM|DOXY|HUSHMAIL|NORDVPN|GOOGLE ?WORKSPACE|MICROSOFT|ADOBE|DROPBOX/, 'software-and-subscriptions'],
  [/PESI|CE4LESS|\bCEU|CONTINUING ED|TRAINING|COURSE/, 'continuing-education'],
  [/STAPLES|OFFICE ?DEPOT|OFFICEMAX|IKEA/, 'office-supplies-and-furniture'],
];

// The card company's own category, mapped to ours as a last resort.
const CARD_CATEGORY_MAP: Record<string, string> = {
  'bills & utilities': 'software-and-subscriptions',
  'merchandise & inventory': 'office-supplies-and-furniture',
  shopping: 'office-supplies-and-furniture',
  'office supplies': 'office-supplies-and-furniture',
  'food & drink': 'meals',
  education: 'continuing-education',
};

export function suggestCategory(description: string, cardCategory: string, state: Pick<AppState, 'rules' | 'categories'>): string {
  const exists = (id: string | undefined): id is string => !!id && state.categories.some((c) => c.id === id);
  const rule = state.rules[merchantKey(description)];
  if (exists(rule?.categoryId)) return rule.categoryId;
  const upper = description.toUpperCase();
  for (const [re, id] of KEYWORD_HINTS) if (re.test(upper) && exists(id)) return id;
  const mapped = CARD_CATEGORY_MAP[cardCategory.trim().toLowerCase()];
  if (exists(mapped)) return mapped;
  return exists(OTHER_CATEGORY_ID) ? OTHER_CATEGORY_ID : state.categories[0]?.id ?? OTHER_CATEGORY_ID;
}

const normDesc = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

/** The identity used for duplicate detection: same date, description and amount (and direction). */
export function fingerprint(e: { date: string; description: string; amountCents: number; kind: string }): string {
  return `${e.date}|${normDesc(e.description)}|${e.kind}|${e.amountCents}`;
}

export function buildImportPreview(csvText: string, state: Pick<AppState, 'rules' | 'categories' | 'expenses'>): ImportPreview {
  const table = parseCSV(csvText);
  if (table.length === 0) return { rows: [], skipped: [], error: 'This file is empty.' };

  const header = table[0];
  const col = {
    date: findCol(header, COLS.date),
    description: findCol(header, COLS.description),
    category: findCol(header, COLS.category),
    type: findCol(header, COLS.type),
    amount: findCol(header, COLS.amount),
  };
  const missing = (['date', 'description', 'amount'] as const).filter((k) => col[k] < 0);
  if (missing.length) {
    return {
      rows: [],
      skipped: [],
      error:
        'This doesn’t look like a credit card statement. The file needs these columns: ' +
        'Transaction Date, Description, Amount (and ideally Type and Category).',
    };
  }

  // How many times each transaction already exists in the app.
  const existing = new Map<string, number>();
  for (const e of state.expenses) {
    if (e.sample) continue; // made-up demo rows must never block a real transaction
    const fp = fingerprint(e);
    existing.set(fp, (existing.get(fp) ?? 0) + 1);
  }
  const seenInFile = new Map<string, number>();

  const rows: PreviewRow[] = [];
  const skipped: SkippedRow[] = [];

  table.slice(1).forEach((r, idx) => {
    const line = idx + 1;
    const get = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
    const description = get(col.description);
    const date = parseDate(get(col.date));
    const signed = parseCents(get(col.amount));
    const type = get(col.type).toLowerCase();

    if (!date) return skipped.push({ line, description, reason: `Couldn’t read the date “${get(col.date)}”` });
    if (signed === null) return skipped.push({ line, description, reason: `Couldn’t read the amount “${get(col.amount)}”` });
    if (signed === 0) return skipped.push({ line, description, reason: 'Amount is $0.00' });

    let kind: 'expense' | 'refund';
    if (type === 'sale') kind = 'expense';
    else if (type === 'return') kind = 'refund';
    else if (type === '') kind = signed < 0 ? 'expense' : 'refund'; // no Type column: use the sign
    else {
      const label = get(col.type);
      const reason = type === 'payment' ? 'Card payment — not an expense' : `Type “${label}” isn’t a purchase or return`;
      return skipped.push({ line, description, reason });
    }

    const amountCents = Math.abs(signed);
    const cardCategory = get(col.category);
    const mk = merchantKey(description);
    const categoryId = suggestCategory(description, cardCategory, state);
    const personal = state.rules[mk]?.personal ?? false;

    const fp = fingerprint({ date, description, amountCents, kind });
    const n = (seenInFile.get(fp) ?? 0) + 1;
    seenInFile.set(fp, n);
    const isDup = n <= (existing.get(fp) ?? 0);

    rows.push({
      line,
      date,
      description,
      merchantKey: mk,
      kind,
      amountCents,
      cardCategory,
      categoryId,
      personal,
      suggestedCategoryId: categoryId,
      suggestedPersonal: personal,
      status: isDup ? 'duplicate' : 'new',
      include: !isDup,
    });
  });

  // Oldest first reads naturally in the preview.
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.line - b.line);
  return { rows, skipped };
}

/**
 * Save the checked preview rows into the state, and remember any category / personal
 * corrections the user made so future imports get them right automatically.
 */
export function commitImport(state: AppState, rows: PreviewRow[]): { state: AppState; added: number } {
  const toAdd: Expense[] = rows
    .filter((r) => r.include)
    .map((r) => ({
      id: newId(),
      date: r.date,
      description: r.description,
      merchantKey: r.merchantKey,
      categoryId: r.categoryId,
      amountCents: r.amountCents,
      kind: r.kind,
      personal: r.personal,
      origin: 'import' as const,
    }));

  const rules = { ...state.rules };
  for (const r of rows) {
    if (!r.include) continue;
    if (r.categoryId !== r.suggestedCategoryId) rules[r.merchantKey] = { ...rules[r.merchantKey], categoryId: r.categoryId };
    if (r.personal !== r.suggestedPersonal) rules[r.merchantKey] = { ...rules[r.merchantKey], personal: r.personal };
  }

  return { state: { ...state, expenses: [...state.expenses, ...toAdd], rules }, added: toAdd.length };
}
