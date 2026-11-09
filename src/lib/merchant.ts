// Turning messy statement text into a stable "merchant key", so that
// "AMAZON PRIME*B93XR6DM3" and "AMAZON PRIME*E91VL5H23" are recognised as the
// same merchant, and "WEB*Network Solutions" matches "networksolutions".

const PROCESSOR_PREFIXES = new Set(['SQ', 'TST', 'SP', 'WEB', 'PAYPAL', 'PP', 'WWW', 'IN', 'DD', 'CKO']);

export function merchantKey(description: string): string {
  let s = description.toUpperCase().trim();
  // Drop a payment-processor prefix such as "SQ *", "TST* ", "WEB*".
  const star = s.indexOf('*');
  if (star > 0) {
    const before = s.slice(0, star).trim();
    if (PROCESSOR_PREFIXES.has(before)) s = s.slice(star + 1);
  }
  const tokens = s
    .split(/[\s*#]+/)
    // Drop reference codes like "B93XR6DM3", "ADS4241772311", "#1234".
    .filter((t) => t && !(/\d/.test(t) && t.length >= 4))
    .filter((t) => !/^\d+$/.test(t));
  const key = tokens.join('').replace(/[^A-Z]/g, '');
  return key || description.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** A tidy name to show for a merchant, from one of its descriptions. */
export function merchantDisplayName(description: string): string {
  const cleaned = description
    .split(/[\s*]+/)
    .filter((t) => t && !(/\d/.test(t) && t.length >= 4))
    .join(' ')
    .trim();
  return cleaned || description;
}
