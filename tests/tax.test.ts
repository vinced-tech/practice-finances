import { describe, expect, it } from 'vitest';
import { parseCSV } from '../src/lib/csv';
import { sampleState } from '../src/lib/seed';
import { taxReport, taxReportCSV } from '../src/lib/tax';

describe('tax report', () => {
  const s = sampleState(2026, 12);
  const r = taxReport(s, 2026);

  it('excludes personal items from every business total', () => {
    expect(r.personalTotal).toBe(12 * 18_99);
    expect(r.businessItems.some((e) => e.personal)).toBe(false);
    const catSum = r.byCategory.reduce((t, c) => t + c.cents, 0);
    expect(catSum).toBe(r.summary.expenses);
  });

  it('income by source and quarters add up to the year', () => {
    expect(r.bySource.reduce((t, x) => t + x.cents, 0)).toBe(r.summary.income);
    expect(r.quarters.reduce((t, q) => t + q.net, 0)).toBe(r.summary.net);
    expect(r.summary.net).toBe(r.summary.income - r.summary.expenses);
  });

  it('CSV export contains the same totals', () => {
    const rows = parseCSV(taxReportCSV(s, 2026));
    const net = rows.find((x) => x[0] === 'Net profit')![1];
    expect(Math.round(Number(net) * 100)).toBe(r.summary.net);
  });
});
