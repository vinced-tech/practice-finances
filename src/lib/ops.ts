// State changes that touch several things at once. All are pure: they return a new state.
import { isValidISODate } from './dates';
import type { AppState, Category } from './model';
import { emptyState, newId } from './model';

const clean = (name: string) => name.trim().replace(/\s+/g, ' ');
const sameName = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

export function addCategory(state: AppState, name: string): { state: AppState; id: string } {
  const n = clean(name);
  const existing = state.categories.find((c) => sameName(c.name, n));
  if (existing) return { state, id: existing.id };
  const cat: Category = { id: newId(), name: n };
  return { state: { ...state, categories: [...state.categories, cat] }, id: cat.id };
}

export function renameCategory(state: AppState, id: string, name: string): AppState {
  const n = clean(name);
  if (!n) return state;
  return { ...state, categories: state.categories.map((c) => (c.id === id ? { ...c, name: n } : c)) };
}

/** Move everything from `fromId` into `intoId`, then remove `fromId`. */
export function mergeCategories(state: AppState, fromId: string, intoId: string): AppState {
  if (fromId === intoId || !state.categories.some((c) => c.id === intoId)) return state;
  const rules = Object.fromEntries(
    Object.entries(state.rules).map(([k, r]) => [k, r.categoryId === fromId ? { ...r, categoryId: intoId } : r]),
  );
  return {
    ...state,
    categories: state.categories.filter((c) => c.id !== fromId),
    expenses: state.expenses.map((e) => (e.categoryId === fromId ? { ...e, categoryId: intoId } : e)),
    rules,
  };
}

export function addSource(state: AppState, name: string): { state: AppState; id: string } {
  const n = clean(name);
  const existing = state.sources.find((s) => sameName(s.name, n));
  if (existing) return { state, id: existing.id };
  const id = newId();
  return { state: { ...state, sources: [...state.sources, { id, name: n }] }, id };
}

export function removeSampleData(state: AppState): AppState {
  return { ...state, income: state.income.filter((i) => !i.sample), expenses: state.expenses.filter((e) => !e.sample) };
}

/** Remember a category / personal choice for a merchant (used by future imports). */
export function learnRule(state: AppState, merchantKey: string, change: { categoryId?: string; personal?: boolean }): AppState {
  return { ...state, rules: { ...state.rules, [merchantKey]: { ...state.rules[merchantKey], ...change } } };
}

// ---------------------------------------------------------------------------
// Backup & restore
// ---------------------------------------------------------------------------

export function makeBackup(state: AppState): string {
  return JSON.stringify({ app: 'practice-finances', exportedAt: new Date().toISOString(), state }, null, 2);
}

/** Read a backup file. Throws an Error with a plain-language message if it isn't valid. */
export function readBackup(text: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file isn’t a backup from this app.');
  }
  const s = (parsed as { state?: AppState })?.state;
  const bad = (why: string) => new Error(`This backup looks damaged (${why}). Nothing was changed.`);
  if (!s || s.version !== 1) throw new Error('This file isn’t a backup from this app.');
  for (const k of ['categories', 'sources', 'income', 'expenses'] as const) if (!Array.isArray(s[k])) throw bad(`missing ${k}`);
  const cents = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
  for (const i of s.income) if (!isValidISODate(i.date) || !cents(i.amountCents) || !i.sourceId) throw bad('an income entry');
  for (const e of s.expenses)
    if (!isValidISODate(e.date) || !cents(e.amountCents) || !e.categoryId || (e.kind !== 'expense' && e.kind !== 'refund'))
      throw bad('an expense entry');
  return { ...emptyState(), ...s, rules: s.rules ?? {}, notSubscriptions: s.notSubscriptions ?? [] };
}
