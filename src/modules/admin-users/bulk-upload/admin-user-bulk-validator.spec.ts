import { AdminRoles } from '../../../common/enums/user.enum';
import { AdminUserBulkValidator } from './admin-user-bulk-validator';

describe('AdminUserBulkValidator', () => {
  const validator = new AdminUserBulkValidator();

  it('returns errors for missing required fields', () => {
    const errors = validator.validateRow({
      rowNumber: 2,
      name: null,
      firstName: null,
      lastName: null,
      email: null,
      userName: null,
      password: null,
      phoneNumber: null,
      role: null,
      status: null,
      rawStatus: null,
      confirmPassword: null,
      permissionGroupName: null,
      departmentName: null,
      permissionGroupsId: [],
      institutionsId: null,
      departmentsId: [],
      s3ProfileImageName: null,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.field === 'email')).toBe(true);
  });

  it('passes valid admin row', () => {
    const errors = validator.validateRow({
      rowNumber: 2,
      name: 'John Admin',
      firstName: null,
      lastName: null,
      email: 'john@naachi.com',
      userName: 'johnadmin',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      permissionGroupName: 'Marketing',
      departmentName: 'Operations',
      phoneNumber: '+919876543210',
      role: AdminRoles.ADMIN,
      status: 'active',
      rawStatus: 'active',
      permissionGroupsId: ['mock-perm-id'],
      institutionsId: null,
      departmentsId: ['mock-dept-id'],
      s3ProfileImageName: null,
    });

    expect(errors).toEqual([]);
  });

  it('rejects phone numbers missing the plus prefix', () => {
    const errors = validator.validateRow({
      rowNumber: 3,
      name: 'John Admin',
      firstName: null,
      lastName: null,
      email: 'john@naachi.com',
      userName: 'johnadmin',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      permissionGroupName: 'Marketing',
      departmentName: 'Operations',
      phoneNumber: '919876543210',
      role: AdminRoles.ADMIN,
      status: 'active',
      rawStatus: 'active',
      permissionGroupsId: ['mock-perm-id'],
      institutionsId: null,
      departmentsId: ['mock-dept-id'],
      s3ProfileImageName: null,
    });

    expect(errors.some((e) => e.field === 'phoneNumber')).toBe(true);
  });
});

