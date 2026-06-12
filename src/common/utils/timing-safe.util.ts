import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison to mitigate timing attacks on secrets
 * (passwords, tokens, OTP codes). Requires equal-length buffers internally;
 * length mismatches still run a dummy compare to avoid leaking length.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }

  return timingSafeEqual(left, right);
}

/** Returns true when two password strings are the same (timing-safe). */
export function passwordsMatch(stored: string, provided: string): boolean {
  return timingSafeEqualString(stored, provided);
}

/** Returns true when two password strings differ (timing-safe). */
export function passwordsDiffer(stored: string, provided: string): boolean {
  return !passwordsMatch(stored, provided);
}
