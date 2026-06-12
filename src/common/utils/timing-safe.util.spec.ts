import {
  passwordsDiffer,
  passwordsMatch,
  timingSafeEqualString,
} from './timing-safe.util';

describe('timingSafeEqualString', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqualString('secret123', 'secret123')).toBe(true);
  });

  it('returns false for different strings of equal length', () => {
    expect(timingSafeEqualString('secret123', 'secret124')).toBe(false);
  });

  it('returns false for different lengths without throwing', () => {
    expect(timingSafeEqualString('short', 'much-longer-value')).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(timingSafeEqualString(null as unknown as string, 'abc')).toBe(false);
    expect(timingSafeEqualString('abc', undefined as unknown as string)).toBe(false);
  });
});

describe('passwordsMatch / passwordsDiffer', () => {
  it('passwordsMatch mirrors timingSafeEqualString', () => {
    expect(passwordsMatch('stored', 'stored')).toBe(true);
    expect(passwordsMatch('stored', 'other')).toBe(false);
  });

  it('passwordsDiffer is the inverse of passwordsMatch', () => {
    expect(passwordsDiffer('stored', 'stored')).toBe(false);
    expect(passwordsDiffer('stored', 'other')).toBe(true);
  });
});
