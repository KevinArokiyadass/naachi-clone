import { normalizeAdminUserUploadRow, normalizeEmail, normalizePhone } from './admin-user-bulk-normalizer';

describe('AdminUserBulkNormalizer', () => {
  it('normalizes email and phone', () => {
    expect(normalizeEmail(' TEST@Example.COM ')).toBe('test@example.com');
    expect(normalizePhone(' +91 98765-43210 ')).toBe('+919876543210');
  });

  it('normalizes complete row', () => {
    const row = normalizeAdminUserUploadRow({
      rowNumber: 2,
      data: {
        name: ' Test User ',
        email: 'User@Test.com',
        password: 'Password123',
        role: 'ADMIN',
        permissionGroupsId: 'g1,g2',
        departmentsId: 'd1,d2',
      },
    });

    expect(row.name).toBe('Test User');
    expect(row.email).toBe('user@test.com');
    expect(row.permissionGroupsId).toEqual(['g1', 'g2']);
    expect(row.departmentsId).toEqual(['d1', 'd2']);
  });
});

