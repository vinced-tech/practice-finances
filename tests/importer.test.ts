import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildImportPreview, commitImport } from '../src/lib/importer';
import { merchantKey } from '../src/lib/merchant';
import { emptyState } from '../src/lib/model';
import { sampleState } from '../src/lib/seed';
import { detectSubscriptions } from '../src/lib/subscriptions';
import { categoryTotals, summarize } from '../src/lib/totals';

const HEADER = 'Transaction Date,Post Date,Description,Category,Type,Amount';
const csv = (...lines: string[]) => [HEADER, ...lines].join('\n');

describe('CSV import: sales and returns', () => {
  it('turns Sale rows into positive expenses', () => {
    const p = buildImportPreview(csv('01/08/2026,01/09/2026,CPH LIABILITY INSURANC,Bills & Utilities,Sale,-297.00'), emptyState());
    expect(p.error).toBeUndefined();
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ date: '2026-01-08', kind: 'expense', amountCents: 29700, categoryId: 'insurance', include: true });
  });

  it('turns Return rows into refunds that reduce their category', () => {
    let s = emptyState();
    const p = buildImportPreview(
      csv(
        '05/08/2026,05/10/2026,networksolutions,Bills & Utilities,Sale,-143.76',
        '05/08/2026,05/10/2026,networksolutions,Bills & Utilities,Sale,-16.80',
        '05/08/2026,05/10/2026,networksolutions,Bills & Utilities,Return,143.76',
      ),
      s,
    );
    // The sale and the return have the same date/description/amount but are NOT duplicates of each other.
    expect(p.rows.map((r) => [r.kind, r.amountCents, r.status])).toEqual([
      ['expense', 14376, 'new'],
      ['expense', 1680, 'new'],
      ['refund', 14376, 'new'],
    ]);
    s = commitImport(s, p.rows).state;
    expect(summarize(s, { year: 2026, month: 5 }).expenses).toBe(1680);
    expect(categoryTotals(s.expenses, s.categories)).toEqual([
      { categoryId: 'marketing-and-website', name: 'Marketing & Website', cents: 1680 },
    ]);
  });

  it('skips card payments and unreadable rows, explaining why', () => {
    const p = buildImportPreview(
      csv(
        '06/01/2026,06/01/2026,Payment Thank You-Mobile,,Payment,500.00',
        'not a date,06/01/2026,Mystery,,Sale,-1.00',
        '06/02/2026,06/02/2026,Bad amount,,Sale,abc',
        '06/03/2026,06/03/2026,"Quoted, with comma",Shopping,Sale,"-1,000.50"',
      ),
      emptyState(),
    );
    expect(p.skipped.map((s) => s.reason)).toEqual([
      'Card payment — not an expense',
      'Couldn’t read the date “not a date”',
      'Couldn’t read the amount “abc”',
    ]);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ description: 'Quoted, with comma', amountCents: 100050 });
  });

  it('reports a friendly error for a file that is not a statement', () => {
    expect(buildImportPreview('Name,Phone\nA,B', emptyState()).error).toMatch(/columns/);
  });
});

describe('CSV import: duplicates', () => {
  const file = csv(
    '02/03/2026,02/04/2026,apple,Merchandise & Inventory,Sale,-2.99',
    '02/03/2026,02/04/2026,apple,Merchandise & Inventory,Sale,-2.99',
    '02/03/2026,02/04/2026,hulu,Bills & Utilities,Sale,-18.99',
  );

  it('keeps two identical charges the first time (they are both real)', () => {
    const p = buildImportPreview(file, emptyState());
    expect(p.rows.filter((r) => r.status === 'new')).toHaveLength(3);
  });

  it('marks every row as duplicate when the same file is imported again', () => {
    const s = commitImport(emptyState(), buildImportPreview(file, emptyState()).rows).state;
    const again = buildImportPreview(file, s);
    expect(again.rows.every((r) => r.status === 'duplicate' && !r.include)).toBe(true);
    expect(commitImport(s, again.rows).added).toBe(0);
  });

  it('only imports the new rows from an overlapping statement', () => {
    const s = commitImport(emptyState(), buildImportPreview(file, emptyState()).rows).state;
    const next = csv(
      '02/03/2026,02/04/2026,hulu,Bills & Utilities,Sale,-18.99', // already have it
      '02/03/2026,02/04/2026,apple,Merchandise & Inventory,Sale,-2.99', // have 2 of these
      '02/03/2026,02/04/2026,apple,Merchandise & Inventory,Sale,-2.99',
      '02/03/2026,02/04/2026,apple,Merchandise & Inventory,Sale,-2.99', // a 3rd one is new
      '03/03/2026,03/04/2026,hulu,Bills & Utilities,Sale,-18.99', // new month
    );
    const p = buildImportPreview(next, s);
    expect(p.rows.filter((r) => r.status === 'new').map((r) => `${r.date} ${r.description}`)).toEqual([
      '2026-02-03 apple',
      '2026-03-03 hulu',
    ]);
  });
});

describe('CSV import: sample data', () => {
  it('a real charge identical to a sample row is still imported', () => {
    const s = sampleState(2026, 6); // contains "WEB*Network Solutions" $16.80 on the 8th of each month
    const p = buildImportPreview(csv('06/08/2026,06/09/2026,WEB*Network Solutions,Bills & Utilities,Sale,-16.80'), s);
    expect(p.rows[0].status).toBe('new');
  });
});

describe('CSV import: year boundaries', () => {
  it('uses the Transaction Date, not the Post Date', () => {
    const p = buildImportPreview(csv('12/31/2025,01/01/2026,AMAZON MKTPL*UE61D8493,Merchandise & Inventory,Sale,-35.64'), emptyState());
    expect(p.rows[0].date).toBe('2025-12-31');
    const s = commitImport(emptyState(), p.rows).state;
    expect(summarize(s, { year: 2025, month: 12 }).expenses).toBe(3564);
    expect(summarize(s, { year: 2026, month: null }).expenses).toBe(0);
    expect(summarize(s, { year: 2026, month: 12 }).expenses).toBe(0); // the old spreadsheet put it here
  });
});

describe('remembering category choices', () => {
  it('applies a correction to future imports from the same merchant', () => {
    let s = emptyState();
    const p1 = buildImportPreview(csv('01/18/2026,01/19/2026,nordvpn,Professional Services,Sale,-219.00'), s);
    expect(p1.rows[0].categoryId).toBe('software-and-subscriptions');
    p1.rows[0].categoryId = 'other';
    p1.rows[0].personal = true;
    s = commitImport(s, p1.rows).state;

    const p2 = buildImportPreview(csv('01/18/2027,01/19/2027,NORDVPN,Professional Services,Sale,-219.00'), s);
    expect(p2.rows[0]).toMatchObject({ categoryId: 'other', personal: true });
  });

  it('matches merchants despite reference codes', () => {
    expect(merchantKey('AMAZON PRIME*B93XR6DM3')).toBe(merchantKey('AMAZON PRIME*E91VL5H23'));
    expect(merchantKey('WEB*Network Solutions')).toBe(merchantKey('networksolutions'));
    expect(merchantKey('Hulu')).toBe(merchantKey('hulu'));
  });
});

// Uses a real statement that is kept OUT of git (personal financial data). Skipped when absent.
const REAL = new URL('../examples/statement-jan-jun-2026.csv', import.meta.url);
describe.skipIf(!existsSync(REAL))('real statement (Jan–Jun 2026 from the old spreadsheet)', () => {
  const text = readFileSync(REAL, 'utf8');
  const p = buildImportPreview(text, emptyState());
  const s = commitImport(emptyState(), p.rows).state;

  it('imports all 85 rows with nothing skipped', () => {
    expect(p.skipped).toEqual([]);
    expect(p.rows).toHaveLength(85);
  });

  it('2026 spending is $2,605.43 (the $35.64 Dec 2025 purchase belongs to 2025)', () => {
    expect(summarize(s, { year: 2026, month: null }).expenses).toBe(260543);
    expect(summarize(s, { year: 2025, month: null }).expenses).toBe(3564);
  });

  it('finds the recurring subscriptions but not irregular Amazon shopping', () => {
    const names = detectSubscriptions(s.expenses).map((x) => x.merchantKey);
    for (const k of ['SLINGCOM', 'TIDALCOM', 'HULU', 'AUDIBLE', 'GOOGLESERVICES', 'NETWORKSOLUTIONS', 'AMAZONPRIME', 'PARTREON'])
      expect(names).toContain(k);
    expect(names).not.toContain('AMAZONMKTPL');
  });
});
