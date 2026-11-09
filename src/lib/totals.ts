import { monthOf, quarterOf, yearOf } from './dates';
import type { AppState, Expense, Income } from './model';
import { signedExpense } from './model';
import type { Cents } from './money';

export interface Period {
  year: number;
  /** 1–12, or null for the whole year */
  month: number | null;
}

export const inPeriod = (date: string, p: Period) =>
  yearOf(date) === p.year && (p.month === null || monthOf(date) === p.month);

export const businessExpenses = (expenses: Expense[]) => expenses.filter((e) => !e.personal);
export const personalExpenses = (expenses: Expense[]) => expenses.filter((e) => e.personal);

export function totalIncome(income: Income[]): Cents {
  let t = 0;
  for (const i of income) t += i.amountCents;
  return t;
}

/** Spending after refunds. Returns positive cents (refunds can make it smaller, not flip its meaning). */
export function totalExpenses(expenses: Expense[]): Cents {
  let t = 0;
  for (const e of expenses) t += signedExpense(e);
  return t;
}

/**
 * Net profit = Income − Expenses.
 * Expenses are stored as POSITIVE numbers, so they are always subtracted here.
 * (The old spreadsheet stored them as negatives and subtracted again, which added them.)
 */
export function netProfit(incomeCents: Cents, expenseCents: Cents): Cents {
  return incomeCents - expenseCents;
}

export interface Summary {
  income: Cents;
  expenses: Cents;
  net: Cents;
}

/** Business summary for a year or a single month. Personal items never count. */
export function summarize(state: Pick<AppState, 'income' | 'expenses'>, p: Period): Summary {
  const income = totalIncome(state.income.filter((i) => inPeriod(i.date, p)));
  const expenses = totalExpenses(businessExpenses(state.expenses).filter((e) => inPeriod(e.date, p)));
  return { income, expenses, net: netProfit(income, expenses) };
}

/** 12 rows, January..December, for the bar chart. */
export function monthlyTotals(state: Pick<AppState, 'income' | 'expenses'>, year: number): Summary[] {
  return Array.from({ length: 12 }, (_, i) => summarize(state, { year, month: i + 1 }));
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  cents: Cents;
}

/**
 * Totals per category (refunds subtract within their own category), largest first.
 * Categories that net to zero are dropped.
 */
export function categoryTotals(expenses: Expense[], categories: AppState['categories']): CategoryTotal[] {
  const byId = new Map<string, Cents>();
  for (const e of expenses) byId.set(e.categoryId, (byId.get(e.categoryId) ?? 0) + signedExpense(e));
  const nameOf = new Map(categories.map((c) => [c.id, c.name]));
  return [...byId.entries()]
    .filter(([, cents]) => cents !== 0)
    .map(([categoryId, cents]) => ({ categoryId, name: nameOf.get(categoryId) ?? 'Other', cents }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
}

export interface SourceTotal {
  sourceId: string;
  name: string;
  cents: Cents;
}

export function sourceTotals(income: Income[], sources: AppState['sources']): SourceTotal[] {
  const byId = new Map<string, Cents>();
  for (const i of income) byId.set(i.sourceId, (byId.get(i.sourceId) ?? 0) + i.amountCents);
  const nameOf = new Map(sources.map((s) => [s.id, s.name]));
  return [...byId.entries()]
    .map(([sourceId, cents]) => ({ sourceId, name: nameOf.get(sourceId) ?? 'Unknown', cents }))
    .sort((a, b) => b.cents - a.cents);
}

/** Calendar quarters Q1–Q4 (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), business only. */
export function quarterlyTotals(state: Pick<AppState, 'income' | 'expenses'>, year: number): Summary[] {
  const q: Summary[] = [0, 1, 2, 3].map(() => ({ income: 0, expenses: 0, net: 0 }));
  for (const i of state.income) if (yearOf(i.date) === year) q[quarterOf(i.date) - 1].income += i.amountCents;
  for (const e of businessExpenses(state.expenses))
    if (yearOf(e.date) === year) q[quarterOf(e.date) - 1].expenses += signedExpense(e);
  for (const s of q) s.net = netProfit(s.income, s.expenses);
  return q;
}

/** Years that have any data, plus the current year, newest first. */
export function yearsWithData(state: Pick<AppState, 'income' | 'expenses'>, currentYear: number): number[] {
  const ys = new Set<number>([currentYear]);
  for (const i of state.income) ys.add(yearOf(i.date));
  for (const e of state.expenses) ys.add(yearOf(e.date));
  return [...ys].sort((a, b) => b - a);
}
