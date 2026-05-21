import {
  buildPhoneLookupKeys,
  phoneSuffixesOverlap,
  suffixKeysFromDigits,
} from './normalize-phone-lookup.util';

function expectSameKeys(actual: string[], expected: string[]) {
  expect(new Set(actual)).toEqual(new Set(expected));
}

describe('suffixKeysFromDigits', () => {
  it('emits 11/10/9 suffixes for 12-digit E.164 (IN)', () => {
    expectSameKeys(suffixKeysFromDigits('919363039990'), [
      '19363039990',
      '9363039990',
      '363039990',
    ]);
  });

  it('emits 10/9 for 10-digit national (IN)', () => {
    expectSameKeys(suffixKeysFromDigits('9363039990'), ['9363039990', '363039990']);
  });

  it('emits 11/10/9 for 11-digit with leading 0 (IN)', () => {
    expectSameKeys(suffixKeysFromDigits('09946095657'), [
      '09946095657',
      '9946095657',
      '946095657',
    ]);
  });

  it('emits 11/10/9 for UK E.164 mobile', () => {
    expectSameKeys(suffixKeysFromDigits('447912345678'), [
      '47912345678',
      '7912345678',
      '912345678',
    ]);
  });

  it('emits 11/10/9 for UK national with leading 0', () => {
    expectSameKeys(suffixKeysFromDigits('07912345678'), [
      '07912345678',
      '7912345678',
      '912345678',
    ]);
  });

  it('emits 10/9 for UK without leading 0', () => {
    expectSameKeys(suffixKeysFromDigits('7912345678'), ['7912345678', '912345678']);
  });

  it('drops strings shorter than 9 digits', () => {
    expect(suffixKeysFromDigits('12345')).toEqual([]);
  });
});

describe('buildPhoneLookupKeys', () => {
  it('parses formatted E.164 like raw digits', () => {
    expectSameKeys(buildPhoneLookupKeys(['+91 93630-39990']), [
      '19363039990',
      '9363039990',
      '363039990',
    ]);
  });

  it('dedupes across mixed formats for the same subscriber', () => {
    const keys = buildPhoneLookupKeys([
      '9363039990',
      '+919363039990',
      '+91 93630-39990',
    ]);
    expect(keys).toContain('9363039990');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('drops empty, whitespace, too-short, and non-digit entries', () => {
    expect(buildPhoneLookupKeys(['', '  ', '12345', 'abc', null as any])).toEqual(
      [],
    );
  });

  it('includes US 10-digit suffixes from +1 E.164', () => {
    expect(buildPhoneLookupKeys(['+1 202 555 0123'])).toContain('2025550123');
  });
});

describe('phoneSuffixesOverlap', () => {
  it('matches IN E.164 stored vs national input', () => {
    expect(phoneSuffixesOverlap('+919363039990', '9363039990')).toBe(true);
  });

  it('matches IN with leading 0 vs E.164', () => {
    expect(phoneSuffixesOverlap('+919946095657', '09946095657')).toBe(true);
  });

  it('matches UK E.164 vs national 07…', () => {
    expect(phoneSuffixesOverlap('+447912345678', '07912345678')).toBe(true);
  });

  it('matches UK E.164 vs without leading 0', () => {
    expect(phoneSuffixesOverlap('+447912345678', '7912345678')).toBe(true);
  });

  it('does not match unrelated numbers', () => {
    expect(phoneSuffixesOverlap('+919363039990', '7912345678')).toBe(false);
  });
});

