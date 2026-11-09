import { toCSV } from './csv';
import { yearOf } from './dates';
import type { AppState } from './model';
import { signedExpense } from './model';
import { centsToPlain } from './money';
import { businessExpenses, categoryTotals, personalExpenses, quarterlyTotals, sourceTotals, summarize, totalExpenses } from './totals';

export function taxReport(state: AppState, year: number) {
  const inYear = <T extends { date: string }>(xs: T[]) => xs.filter((x) => yearOf(x.date) === year);
  const biz = inYear(businessExpenses(state.expenses));
  const income = inYear(state.income);
  return {
    year,
    summary: summarize(state, { year, month: null }),
    byCategory: categoryTotals(biz, state.categories),
    bySource: sourceTotals(income, state.sources),
    quarters: quarterlyTotals(state, year),
    personalTotal: totalExpenses(inYear(personalExpenses(state.expenses))),
    businessItems: biz.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** One CSV an accountant can open in Excel: summary sections, then every business expense. */
export function taxReportCSV(state: AppState, year: number): string {
  const r = taxReport(state, year);
  const cat = new Map(state.categories.map((c) => [c.id, c.name]));
  const rows: (string | number)[][] = [
    [`Practice finances — tax summary ${year}`],
    [],
    ['SUMMARY', 'Amount'],
    ['Total income', centsToPlain(r.summary.income)],
    ['Total business expenses', centsToPlain(r.summary.expenses)],
    ['Net profit', centsToPlain(r.summary.net)],
    [],
    ['INCOME BY SOURCE', 'Amount'],
    ...r.bySource.map((s) => [s.name, centsToPlain(s.cents)]),
    [],
    ['BUSINESS EXPENSES BY CATEGORY', 'Amount'],
    ...r.byCategory.map((c) => [c.name, centsToPlain(c.cents)]),
    [],
    ['QUARTER', 'Income', 'Expenses', 'Net profit'],
    ...r.quarters.map((q, i) => [`Q${i + 1}`, centsToPlain(q.income), centsToPlain(q.expenses), centsToPlain(q.net)]),
    [],
    ['BUSINESS EXPENSE DETAIL (refunds shown as negative)'],
    ['Date', 'Description', 'Category', 'Amount'],
    ...r.businessItems.map((e) => [e.date, e.description, cat.get(e.categoryId) ?? 'Other', centsToPlain(signedExpense(e))]),
    [],
    ['Personal items excluded from all totals above', centsToPlain(r.personalTotal)],
  ];
  return toCSV(rows);
}
