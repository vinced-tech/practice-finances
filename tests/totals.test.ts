import { describe, expect, it } from 'vitest';
import { emptyState, type AppState, type Expense, type Income } from '../src/lib/model';
import { categoryTotals, monthlyTotals, netProfit, quarterlyTotals, summarize, totalExpenses } from '../src/lib/totals';

let n = 0;
const exp = (p: Partial<Expense> & Pick<Expense, 'date' | 'amountCents' | 'categoryId'>): Expense => ({
  id: `e${n++}`,
  description: 'X',
  merchantKey: 'X',
  kind: 'expense',
  personal: false,
  origin: 'manual',
  ...p,
});
const inc = (date: string, amountCents: number, sourceId = 'talkspace'): Income => ({ id: `i${n++}`, date, amountCents, sourceId });

describe('net profit', () => {
  it('subtracts expenses from income', () => {
    expect(netProfit(100_00, 30_00)).toBe(70_00);
    expect(netProfit(10_00, 30_00)).toBe(-20_00);
  });

  it('fixes the spreadsheet bug: $35,737.11 income − $2,641.07 expenses = $33,096.04 (not $38,378.18)', () => {
    expect(netProfit(3_573_711, 264_107)).toBe(3_309_604);
  });

  it('excludes personal expenses and counts refunds against spending', () => {
    const s: Pick<AppState, 'income' | 'expenses'> = {
      income: [inc('2026-01-15', 5000_00), inc('2026-02-15', 1000_00)],
      expenses: [
        exp({ date: '2026-01-02', amountCents: 300_00, categoryId: 'insurance' }),
        exp({ date: '2026-01-10', amountCents: 18_99, categoryId: 'other', personal: true }),
        exp({ date: '2026-02-03', amountCents: 143_76, categoryId: 'marketing-and-website' }),
        exp({ date: '2026-02-03', amountCents: 143_76, categoryId: 'marketing-and-website', kind: 'refund' }),
      ],
    };
    expect(summarize(s, { year: 2026, month: null })).toEqual({ income: 6000_00, expenses: 300_00, net: 5700_00 });
    expect(summarize(s, { year: 2026, month: 2 })).toEqual({ income: 1000_00, expenses: 0, net: 1000_00 });
  });

  it('keeps years separate', () => {
    const s = { income: [inc('2025-12-31', 100_00)], expenses: [exp({ date: '2025-12-31', amountCents: 35_64, categoryId: 'other' })] };
    expect(summarize(s, { year: 2026, month: null })).toEqual({ income: 0, expenses: 0, net: 0 });
    expect(summarize(s, { year: 2025, month: 12 }).net).toBe(64_36);
    expect(monthlyTotals(s, 2026).every((m) => m.income === 0 && m.expenses === 0)).toBe(true);
  });
});

describe('category totals', () => {
  const cats = emptyState().categories;
  const list = [
    exp({ date: '2026-01-01', amountCents: 16_80, categoryId: 'marketing-and-website' }),
    exp({ date: '2026-02-01', amountCents: 16_80, categoryId: 'marketing-and-website' }),
    exp({ date: '2026-01-08', amountCents: 297_00, categoryId: 'insurance' }),
    exp({ date: '2026-05-19', amountCents: 8_87, categoryId: 'marketing-and-website', kind: 'refund' }),
    exp({ date: '2026-03-01', amountCents: 5_00, categoryId: 'meals' }),
    exp({ date: '2026-03-02', amountCents: 5_00, categoryId: 'meals', kind: 'refund' }),
  ];

  it('sums per category, subtracts refunds in their own category, largest first, drops zeros', () => {
    expect(categoryTotals(list, cats)).toEqual([
      { categoryId: 'insurance', name: 'Insurance', cents: 297_00 },
      { categoryId: 'marketing-and-website', name: 'Marketing & Website', cents: 24_73 },
    ]);
  });

  it('category totals add up to total expenses', () => {
    const sum = categoryTotals(list, cats).reduce((t, c) => t + c.cents, 0);
    expect(sum).toBe(totalExpenses(list));
  });

  it('quarterly totals add up to the year', () => {
    const s = { income: [inc('2026-03-31', 10_00), inc('2026-04-01', 20_00), inc('2026-12-31', 5_00)], expenses: list };
    const q = quarterlyTotals(s, 2026);
    expect(q.map((x) => x.income)).toEqual([10_00, 20_00, 0, 5_00]);
    const year = summarize(s, { year: 2026, month: null });
    expect(q.reduce((t, x) => t + x.expenses, 0)).toBe(year.expenses);
    expect(q.reduce((t, x) => t + x.net, 0)).toBe(year.net);
  });
});
