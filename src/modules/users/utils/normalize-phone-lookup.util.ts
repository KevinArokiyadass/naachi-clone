/**
 * Prepares phone numbers for users-by-phone lookup. Clients should send E.164 (+country…).
 * We only trim, strip common formatting (spaces, dashes), dedupe, and build the Mongo `$in` list.
 */

function normalizeOne(raw: unknown): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** Distinct values for `phoneNumber: { $in: … }` (matches DB E.164 when client sends the same). */
export function normalizePhoneNumbersForLookup(phoneNumbers: string[]): string[] {
  if (!phoneNumbers?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of phoneNumbers) {
    const n = normalizeOne(raw);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}
