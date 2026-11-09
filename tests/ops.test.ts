import { describe, expect, it } from 'vitest';
import { emptyState } from '../src/lib/model';
import { addCategory, makeBackup, mergeCategories, readBackup, removeSampleData, renameCategory } from '../src/lib/ops';
import { sampleState } from '../src/lib/seed';
import { summarize } from '../src/lib/totals';

describe('categories', () => {
  it('merging moves expenses and remembered rules, and keeps totals unchanged', () => {
    let s = sampleState(2026, 6);
    s = { ...s, rules: { ZOOMUS: { categoryId: 'software-and-subscriptions' } } };
    const before = summarize(s, { year: 2026, month: null });
    s = mergeCategories(s, 'software-and-subscriptions', 'other');
    expect(s.categories.some((c) => c.id === 'software-and-subscriptions')).toBe(false);
    expect(s.expenses.some((e) => e.categoryId === 'software-and-subscriptions')).toBe(false);
    expect(s.rules.ZOOMUS.categoryId).toBe('other');
    expect(summarize(s, { year: 2026, month: null })).toEqual(before);
  });

  it('adding a name that already exists reuses it; rename trims', () => {
    const { state, id } = addCategory(emptyState(), '  insurance ');
    expect(id).toBe('insurance');
    expect(state.categories).toHaveLength(9);
    expect(renameCategory(state, 'meals', '  Meals & Coffee ').categories.find((c) => c.id === 'meals')!.name).toBe('Meals & Coffee');
  });
});

describe('sample data & backup', () => {
  it('sample data can be removed completely', () => {
    const s = removeSampleData(sampleState(2026, 10));
    expect(s.income).toHaveLength(0);
    expect(s.expenses).toHaveLength(0);
  });

  it('backup round-trips exactly', () => {
    const s = sampleState(2026, 3);
    expect(readBackup(makeBackup(s))).toEqual(s);
  });

  it('rejects damaged backups with a plain message', () => {
    expect(() => readBackup('nope')).toThrow(/isn’t a backup/);
    const s = sampleState(2026, 1);
    s.expenses[0].amountCents = 12.5;
    expect(() => readBackup(makeBackup(s))).toThrow(/damaged/);
  });
});
