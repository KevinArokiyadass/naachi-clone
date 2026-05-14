import { UserBulkValidator } from './user-bulk-validator';

describe('UserBulkValidator', () => {
  const validator = new UserBulkValidator();

  it('allows omitted status (rawStatus empty)', () => {
    const errors = validator.validateRow({
      rowNumber: 2,
      name: 'A',
      email: 'test@example.com',
      userName: null,
      phoneNumber: '+447911111111',
      status: null,
      rawStatus: null,
      departmentName: 'Dept',
    });
    expect(errors.filter((e) => e.field === 'status')).toHaveLength(0);
  });

  it('rejects invalid status when a value was provided', () => {
    const errors = validator.validateRow({
      rowNumber: 3,
      name: 'B',
      email: 'test@example.com',
      userName: null,
      phoneNumber: '+447922222222',
      status: null,
      rawStatus: 'not-a-status',
      departmentName: 'Dept',
    });
    expect(errors.some((e) => e.field === 'status')).toBe(true);
  });

  it('accepts valid status', () => {
    const errors = validator.validateRow({
      rowNumber: 4,
      name: 'C',
      email: 'test@example.com',
      userName: null,
      phoneNumber: '+447933333333',
      status: 'blocked',
      rawStatus: 'blocked',
      departmentName: 'Dept',
    });
    expect(errors.filter((e) => e.field === 'status')).toHaveLength(0);
  });

  it('rejects phone number missing country code + prefix', () => {
    const errors = validator.validateRow({
      rowNumber: 5,
      name: 'D',
      email: 'test@example.com',
      userName: null,
      phoneNumber: '447944444444',
      status: 'active',
      rawStatus: 'active',
      departmentName: 'Dept',
    });
    expect(errors.some((e) => e.message.includes('Country code is compulsory'))).toBe(true);
  });

  it('rejects row missing email address', () => {
    const errors = validator.validateRow({
      rowNumber: 6,
      name: 'E',
      email: null,
      userName: null,
      phoneNumber: '+447955555555',
      status: 'active',
      rawStatus: 'active',
      departmentName: 'Dept',
    });
    expect(errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('rejects row missing department', () => {
    const errors = validator.validateRow({
      rowNumber: 7,
      name: 'F',
      email: 'test@example.com',
      userName: null,
      phoneNumber: '+447966666666',
      status: 'active',
      rawStatus: 'active',
      departmentName: null,
    });
    expect(errors.some((e) => e.field === 'departmentName')).toBe(true);
  });
});
