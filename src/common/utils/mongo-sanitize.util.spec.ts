import { sanitizeMongoInput, prepareMongoFilter } from './mongo-sanitize.util';

describe('sanitizeMongoInput', () => {
  it('strips operator keys from nested objects', () => {
    const input = { userId: { $ne: '5' }, name: 'alice' };
    expect(sanitizeMongoInput(input)).toEqual({ userId: {}, name: 'alice' });
  });

  it('strips operator keys from arrays', () => {
    const input = [{ $gt: 1 }, { ok: true }];
    expect(sanitizeMongoInput(input)).toEqual([{}, { ok: true }]);
  });

  it('preserves dates and primitives', () => {
    const date = new Date('2024-01-01');
    expect(sanitizeMongoInput('abc')).toBe('abc');
    expect(sanitizeMongoInput(date)).toBe(date);
  });
});

describe('prepareMongoFilter', () => {
  it('wraps scalar fields with $eq', () => {
    expect(prepareMongoFilter({ userId: 'u-1', isDeleted: false })).toEqual({
      userId: { $eq: 'u-1' },
      isDeleted: { $eq: false },
    });
  });

  it('preserves intentional operator documents on fields', () => {
    expect(prepareMongoFilter({ adminId: 'a-1', isDeleted: { $ne: true } })).toEqual({
      adminId: { $eq: 'a-1' },
      isDeleted: { $ne: true },
    });
  });

  it('processes $or branches recursively', () => {
    expect(
      prepareMongoFilter({
        $or: [{ userId: 'u-1' }, { email: 'a@b.com' }],
      }),
    ).toEqual({
      $or: [{ userId: { $eq: 'u-1' } }, { email: { $eq: 'a@b.com' } }],
    });
  });

  it('sanitizeMongoInput neutralizes operator injection before queries', () => {
    expect(sanitizeMongoInput({ userId: { $ne: '5' } })).toEqual({ userId: {} });
  });
});
