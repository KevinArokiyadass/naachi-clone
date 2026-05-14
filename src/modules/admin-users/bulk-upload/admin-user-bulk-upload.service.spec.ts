import { AdminRoles } from '../../../common/enums/user.enum';
import { AdminUserBulkUploadService } from './admin-user-bulk-upload.service';
import { AdminUserBulkMetricsService } from './admin-user-bulk-metrics.service';
import { AdminUserBulkParser } from './admin-user-bulk-parser';
import { AdminUserBulkRepository } from './admin-user-bulk.repository';
import { AdminUserBulkValidator } from './admin-user-bulk-validator';

jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'mock-id',
}));

describe('AdminUserBulkUploadService', () => {
  const parser = {
    parse: jest.fn(),
  } as unknown as AdminUserBulkParser;
  const validator = new AdminUserBulkValidator();
  const repository = {
    findExistingByUniqueKeys: jest.fn(),
  } as unknown as AdminUserBulkRepository;
  const adminUserService = {
    createAdminUser: jest.fn(),
    update: jest.fn(),
    validateInstitutionScope: jest.fn(),
    getBulkUploadOptions: jest.fn(),
  } as any;
  const metrics = new AdminUserBulkMetricsService();

  const service = new AdminUserBulkUploadService(
    parser,
    validator,
    repository,
    adminUserService,
    metrics,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    adminUserService.getBulkUploadOptions = jest.fn().mockResolvedValue({
      permissions: [{ name: 'Marketing', permissionGroupsId: 'pg-1' }],
      departments: [{ departmentName: 'Operations', departmentsId: 'dep-1' }],
    });
  });

  it('supports dry run without writes', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'John',
          phoneNumber: '+447912345678',
          email: 'john@naachi.com',
          status: 'active',
          permissionGroupName: 'Marketing',
          departmentName: 'Operations',
          password: 'Password@123',
          confirmPassword: 'Password@123',
        },
      },
    ]);
    repository.findExistingByUniqueKeys = jest.fn().mockResolvedValue({
      byEmail: new Map(),
      byUserName: new Map(),
      byPhoneNumber: new Map(),
    });

    const result = await service.processUpload(
      {} as Express.Multer.File,
      { dryRun: true },
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );
    expect(result.successCount).toBe(1);
    expect(result.uploadOutcome).toBe('success');
    expect(adminUserService.createAdminUser).not.toHaveBeenCalled();
  });

  it('marks duplicate rows within file', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'A',
          phoneNumber: '+447912345678',
          email: 'dup@naachi.com',
          status: 'active',
          permissionGroupName: 'Marketing',
          departmentName: 'Operations',
          password: 'Password@123',
          confirmPassword: 'Password@123',
        },
      },
      {
        rowNumber: 3,
        data: {
          name: 'B',
          phoneNumber: '+447912345679',
          email: 'dup@naachi.com',
          status: 'active',
          permissionGroupName: 'Marketing',
          departmentName: 'Operations',
          password: 'Password@123',
          confirmPassword: 'Password@123',
        },
      },
    ]);
    repository.findExistingByUniqueKeys = jest.fn().mockResolvedValue({
      byEmail: new Map(),
      byUserName: new Map(),
      byPhoneNumber: new Map(),
    });
    adminUserService.createAdminUser = jest.fn().mockResolvedValue({ adminUser: { adminId: 'a-1' } });

    const result = await service.processUpload(
      {} as Express.Multer.File,
      {},
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );
    expect(result.duplicateCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.successCount).toBe(1);
    expect(result.uploadOutcome).toBe('partial_failure');
  });

  it('updates existing rows when updateExisting is true', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'A',
          phoneNumber: '+447912345678',
          email: 'dup@naachi.com',
          status: 'active',
          permissionGroupName: 'Marketing',
          departmentName: 'Operations',
          password: 'Password@123',
          confirmPassword: 'Password@123',
          role: AdminRoles.ADMIN,
        },
      },
    ]);
    repository.findExistingByUniqueKeys = jest.fn().mockResolvedValue({
      byEmail: new Map([['dup@naachi.com', { adminId: 'adm-1', email: 'dup@naachi.com' }]]),
      byUserName: new Map(),
      byPhoneNumber: new Map(),
    });
    adminUserService.update = jest.fn().mockResolvedValue({});

    const result = await service.processUpload(
      {} as Express.Multer.File,
      { updateExisting: true, skipExisting: false },
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );
    expect(result.updatedIds).toEqual(['adm-1']);
    expect(adminUserService.update).toHaveBeenCalledWith('adm-1', expect.any(Object));
  });
});

