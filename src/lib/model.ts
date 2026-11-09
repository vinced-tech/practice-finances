import type { Cents } from './money';
import type { ISODate } from './dates';

// ---------------------------------------------------------------------------
// Data model. Everything lives in one AppState object saved in IndexedDB.
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
}

export interface IncomeSource {
  id: string;
  name: string; // e.g. "Talkspace", "Grow Therapy", "Private client" — never a client's name
}

export interface Income {
  id: string;
  date: ISODate;
  sourceId: string;
  amountCents: Cents; // always positive
  note?: string;
  sample?: boolean; // true for the demo data shown on first open
}

/**
 * One line of money going out.
 * `amountCents` is ALWAYS positive. `kind` says which way it counts:
 *   - "expense": adds to spending
 *   - "refund":  a credit-card Return; reduces spending in its category
 */
export interface Expense {
  id: string;
  date: ISODate; // the Transaction Date (decides month and year)
  description: string; // as shown on the statement
  merchantKey: string; // normalized merchant, used for remembering categories + subscriptions
  categoryId: string;
  amountCents: Cents;
  kind: 'expense' | 'refund';
  personal: boolean; // personal items are excluded from every business total
  origin: 'manual' | 'import';
  sample?: boolean;
}

/** What we remember about a merchant after the user corrects it once. */
export interface MerchantRule {
  categoryId?: string;
  personal?: boolean;
}

export interface AppState {
  version: 1;
  categories: Category[];
  sources: IncomeSource[];
  income: Income[];
  expenses: Expense[];
  /** merchantKey -> remembered choices */
  rules: Record<string, MerchantRule>;
  /** merchantKeys the user said are NOT subscriptions */
  notSubscriptions: string[];
}

export const DEFAULT_CATEGORY_NAMES = [
  'Insurance',
  'Licensing & Fees',
  'Software & Subscriptions',
  'Billing & Claims',
  'Office Supplies & Furniture',
  'Marketing & Website',
  'Continuing Education',
  'Meals',
  'Other',
] as const;

export const DEFAULT_SOURCE_NAMES = ['Talkspace', 'Grow Therapy', 'Private client'] as const;

/** Stable ids for the defaults so rules and seeds can refer to them. */
export const slug = (name: string) =>
  name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyState(): AppState {
  return {
    version: 1,
    categories: DEFAULT_CATEGORY_NAMES.map((name) => ({ id: slug(name), name })),
    sources: DEFAULT_SOURCE_NAMES.map((name) => ({ id: slug(name), name })),
    income: [],
    expenses: [],
    rules: {},
    notSubscriptions: [],
  };
}

export const OTHER_CATEGORY_ID = 'other';

/** Signed effect of an expense row on spending: + for expenses, − for refunds. */
export const signedExpense = (e: Expense): Cents => (e.kind === 'refund' ? -e.amountCents : e.amountCents);
