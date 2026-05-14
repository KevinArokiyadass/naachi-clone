import { normalizePhoneNumbersForLookup } from './normalize-phone-lookup.util';

describe('normalizePhoneNumbersForLookup', () => {
  it('strips spaces and punctuation but keeps E.164', () => {
    expect(normalizePhoneNumbersForLookup(['+91 98987-99980'])).toEqual(['+919898799980']);
  });

  it('dedupes identical numbers after normalization', () => {
    expect(normalizePhoneNumbersForLookup(['+919898799980', '+91 98987 99980'])).toEqual([
      '+919898799980',
    ]);
  });

  it('passes through digit-only payload when no leading +', () => {
    expect(normalizePhoneNumbersForLookup(['919898799980'])).toEqual(['919898799980']);
  });

  it('drops empty entries', () => {
    expect(normalizePhoneNumbersForLookup(['', '  ', '+1 202 555 0123'])).toEqual(['+12025550123']);
  });
});
