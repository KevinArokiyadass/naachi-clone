import { UserBulkValidator } from './user-bulk-validator';

describe('UserBulkValidator', () => {
  const validator = new UserBulkValidator();

  it('allows omitted status (rawStatus empty)', () => {
    const errors = validator.validateRow({
      rowNumber: 2,
      name: 'A',
      email: null,
      userName: null,
      phoneNumber: '+447911111111',
      status: null,
      rawStatus: null,
    });
    expect(errors.filter((e) => e.field === 'status')).toHaveLength(0);
  });

  it('rejects invalid status when a value was provided', () => {
    const errors = validator.validateRow({
      rowNumber: 3,
      name: 'B',
      email: null,
      userName: null,
      phoneNumber: '+447922222222',
      status: null,
      rawStatus: 'not-a-status',
    });
    expect(errors.some((e) => e.field === 'status')).toBe(true);
  });

  it('accepts valid status', () => {
    const errors = validator.validateRow({
      rowNumber: 4,
      name: 'C',
      email: null,
      userName: null,
      phoneNumber: '+447933333333',
      status: 'blocked',
      rawStatus: 'blocked',
    });
    expect(errors.filter((e) => e.field === 'status')).toHaveLength(0);
  });
});
