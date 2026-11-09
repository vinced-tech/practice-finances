// All money in this app is stored and calculated as INTEGER CENTS.
// $12.34 is stored as 1234. Floats are never used for arithmetic.

export type Cents = number;

/**
 * Parse a money string into integer cents without ever using float math.
 * Accepts: "12", "12.5", "12.50", "-12.50", "$1,234.56", "(12.50)" (accounting negative).
 * Returns null if the text is not a valid amount (or has more than 2 decimals).
 */
export function parseCents(input: string | number): Cents | null {
  let s = String(input).trim();
  if (s === '') return null;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }
  s = s.replace(/^\$/, '').replace(/,/g, '').trim();
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m || (m[1] === '' && (m[2] === undefined || m[2] === ''))) return null;
  const whole = m[1] === '' ? 0 : Number(m[1]);
  const frac = Number((m[2] ?? '').padEnd(2, '0'));
  const cents = whole * 100 + frac;
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Format cents as US dollars, e.g. 123456 -> "$1,234.56". Built from integers. */
export function formatUSD(cents: Cents, opts: { showSign?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const pennies = (abs % 100).toString().padStart(2, '0');
  const body = `$${dollars}.${pennies}`;
  return neg && opts.showSign ? `−${body}` : body;
}

/** Cents -> plain "1234.56" string for CSV export and form fields (no $ or commas). */
export function centsToPlain(cents: Cents): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  return `${neg ? '-' : ''}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, '0')}`;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
