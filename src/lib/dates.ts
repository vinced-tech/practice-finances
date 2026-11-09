// Dates are stored as plain "YYYY-MM-DD" strings (calendar dates, no time zone).
// We deliberately avoid `new Date("2025-12-31")`, which is read as UTC midnight
// and shows up as Dec 30 in Illinois — exactly the kind of bug that moves a
// purchase into the wrong month or year.

export type ISODate = string; // "YYYY-MM-DD"

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

function valid(y: number, m: number, d: number): boolean {
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1)) return false;
  const daysInMonth = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= daysInMonth[m - 1];
}

function iso(y: number, m: number, d: number): ISODate {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Parse a date from a bank CSV. Supports "MM/DD/YYYY", "M/D/YY", and "YYYY-MM-DD".
 * Returns null for anything we can't read with certainty.
 */
export function parseDate(input: string): ISODate | null {
  const s = input.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return valid(y, mo, d) ? iso(y, mo, d) : null;
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (m) {
    let y = Number(m[3]);
    if (m[3].length === 2) y += 2000;
    const [mo, d] = [Number(m[1]), Number(m[2])];
    return valid(y, mo, d) ? iso(y, mo, d) : null;
  }
  return null;
}

export const yearOf = (d: ISODate): number => Number(d.slice(0, 4));
/** 1–12 */
export const monthOf = (d: ISODate): number => Number(d.slice(5, 7));
/** "YYYY-MM" */
export const monthKey = (d: ISODate): string => d.slice(0, 7);
/** 1–4 */
export const quarterOf = (d: ISODate): number => Math.ceil(monthOf(d) / 3);

export function todayISO(): ISODate {
  const now = new Date();
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** "2026-03-05" -> "Mar 5, 2026" */
export function formatDate(d: ISODate): string {
  return `${MONTH_SHORT[monthOf(d) - 1]} ${Number(d.slice(8, 10))}, ${yearOf(d)}`;
}

export function isValidISODate(d: string): boolean {
  return parseDate(d) === d;
}
