/**
 * Builds suffix keys for users-by-phone lookup. Matches stored E.164 against
 * national/local contact formats by comparing overlapping 9/10/11-digit tails.
 */

export const PHONE_SUFFIX_LENGTHS = [11, 10, 9] as const;
const MIN_LEN = Math.min(...PHONE_SUFFIX_LENGTHS);

function digitsOnly(raw: unknown): string {
  return raw == null ? '' : String(raw).replace(/\D/g, '');
}

/** Last 9/10/11 digit suffixes of a digits-only string (when long enough). */
export function suffixKeysFromDigits(digits: string): string[] {
  if (digits.length < MIN_LEN) return [];
  const out: string[] = [];
  for (const L of PHONE_SUFFIX_LENGTHS) {
    if (digits.length >= L) out.push(digits.slice(-L));
  }
  return out;
}

export function buildPhoneLookupKeys(phoneNumbers: string[]): string[] {
  if (!phoneNumbers?.length) return [];
  const seen = new Set<string>();
  for (const raw of phoneNumbers) {
    for (const k of suffixKeysFromDigits(digitsOnly(raw))) {
      seen.add(k);
    }
  }
  return [...seen];
}

/** True when any suffix of a overlaps any suffix of b (same rule as DB $expr match). */
export function phoneSuffixesOverlap(a: string, b: string): boolean {
  const keysA = new Set(suffixKeysFromDigits(digitsOnly(a)));
  for (const k of suffixKeysFromDigits(digitsOnly(b))) {
    if (keysA.has(k)) return true;
  }
  return false;
}
