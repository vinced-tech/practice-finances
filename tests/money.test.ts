import { describe, expect, it } from 'vitest';
import { formatUSD, parseCents, centsToPlain } from '../src/lib/money';
import { parseDate, quarterOf } from '../src/lib/dates';

describe('parseCents', () => {
  it('reads common money formats as exact integer cents', () => {
    expect(parseCents('12')).toBe(1200);
    expect(parseCents('12.5')).toBe(1250);
    expect(parseCents('-16.80')).toBe(-1680);
    expect(parseCents('$1,234.56')).toBe(123456);
    expect(parseCents('(12.00)')).toBe(-1200);
    expect(parseCents('.99')).toBe(99);
  });
  it('avoids float rounding (0.1 + 0.2 problem)', () => {
    expect(parseCents('0.10')! + parseCents('0.20')!).toBe(30);
    // 1.005 would round wrongly with floats; we reject 3 decimals instead of guessing.
    expect(parseCents('1.005')).toBeNull();
  });
  it('rejects junk', () => {
    expect(parseCents('')).toBeNull();
    expect(parseCents('abc')).toBeNull();
    expect(parseCents('.')).toBeNull();
  });
});

describe('formatUSD', () => {
  it('formats with two decimals and thousands separators', () => {
    expect(formatUSD(0)).toBe('$0.00');
    expect(formatUSD(5)).toBe('$0.05');
    expect(formatUSD(3573711)).toBe('$35,737.11');
  });
  it('never shows a minus sign unless asked', () => {
    expect(formatUSD(-1680)).toBe('$16.80');
    expect(formatUSD(-1680, { showSign: true })).toBe('−$16.80');
  });
  it('plain export format', () => {
    expect(centsToPlain(123456)).toBe('1234.56');
    expect(centsToPlain(-5)).toBe('-0.05');
  });
});

describe('dates', () => {
  it('parses statement dates without time-zone shifts', () => {
    expect(parseDate('12/31/2025')).toBe('2025-12-31');
    expect(parseDate('1/2/26')).toBe('2026-01-02');
    expect(parseDate('2026-03-05')).toBe('2026-03-05');
    expect(parseDate('02/30/2026')).toBeNull();
    expect(parseDate('02/29/2024')).toBe('2024-02-29');
  });
  it('assigns quarters', () => {
    expect([quarterOf('2026-01-01'), quarterOf('2026-03-31'), quarterOf('2026-04-01'), quarterOf('2026-12-31')]).toEqual([1, 1, 2, 4]);
  });
});
