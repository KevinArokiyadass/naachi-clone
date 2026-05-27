import { UserBulkParser } from './user-bulk-parser';
import { UserBulkRepository } from './user-bulk.repository';
import { UserBulkUploadService } from './user-bulk-upload.service';
import { UserBulkValidator } from './user-bulk-validator';

jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'mock-id',
}));

describe('UserBulkUploadService', () => {
  const parser = {
    parse: jest.fn(),
  } as unknown as UserBulkParser;
  const validator = new UserBulkValidator();
  const repository = {
    findExistingByUniqueKeys: jest.fn(),
  } as unknown as UserBulkRepository;
  const usersService = {
    validateInstitutionScope: jest.fn(),
    assertBulkUploadUserLimitNotExceeded: jest.fn().mockResolvedValue(undefined),
    getBulkUploadOptions: jest.fn().mockResolvedValue({
      institutionsId: 'inst-1',
      departments: [{ departmentName: 'Science', departmentsId: 'dept-sci' }],
    }),
    createInstitutionManagedUser: jest.fn(),
    updateInstitutionManagedUser: jest.fn(),
  } as any;



  const service = new UserBulkUploadService(
    parser,
    validator,
    repository,
    usersService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.assertBulkUploadUserLimitNotExceeded = jest.fn().mockResolvedValue(undefined);
  });

  it('supports dry run without writes and emits csv report', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'John Student',
          phoneNumber: '+447912345678',
          email: 'john@student.com',
          userName: 'john.student',
          status: 'active',
          departmentName: 'Science',
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
      { dryRun: true, includeCsvReport: true },
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );

    expect(result.successCount).toBe(1);
    expect(usersService.createInstitutionManagedUser).not.toHaveBeenCalled();
    expect(result.reportFileName).toContain('user-bulk-upload-report-inst-1');
    expect(result.reportCsvBase64).toBeDefined();
  });

  it('updates existing rows when updateExisting is true', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'Updated Student',
          phoneNumber: '+447912345678',
          email: 'existing@student.com',
          status: 'active',
          departmentName: 'Science',
        },
      },
    ]);
    repository.findExistingByUniqueKeys = jest.fn().mockResolvedValue({
      byEmail: new Map(),
      byUserName: new Map(),
      byPhoneNumber: new Map([
        ['+447912345678', { userId: 'usr-1', phoneNumber: '+447912345678' }],
      ]),
    });
    usersService.updateInstitutionManagedUser = jest.fn().mockResolvedValue(undefined);

    const result = await service.processUpload(
      {} as Express.Multer.File,
      { updateExisting: true, skipExisting: false },
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );

    expect(result.updatedIds).toEqual(['usr-1']);
    expect(usersService.updateInstitutionManagedUser).toHaveBeenCalledWith(
      'usr-1',
      expect.any(Object),
    );
  });

  it('links existing global user by email to the institution', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'Global Student',
          phoneNumber: '+447912345678',
          email: 'global@student.com',
          status: 'active',
          departmentName: 'Science',
        },
      },
    ]);
    repository.findExistingByUniqueKeys = jest.fn().mockResolvedValue({
      byEmail: new Map([
        [
          'global@student.com',
          { userId: 'usr-global', email: 'global@student.com', institutionsId: undefined },
        ],
      ]),
      byUserName: new Map(),
      byPhoneNumber: new Map(),
    });
    usersService.updateInstitutionManagedUser = jest.fn().mockResolvedValue(undefined);

    const result = await service.processUpload(
      {} as Express.Multer.File,
      {},
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );

    expect(result.updatedIds).toEqual(['usr-global']);
    expect(result.successCount).toBe(1);
    expect(usersService.createInstitutionManagedUser).not.toHaveBeenCalled();
    expect(usersService.updateInstitutionManagedUser).toHaveBeenCalledWith(
      'usr-global',
      expect.objectContaining({
        institutionsId: 'inst-1',
        email: 'global@student.com',
      }),
    );
  });

  it('rejects rows for users already linked to the same institution with no changes', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'Existing Student',
          phoneNumber: '+447912345678',
          email: 'existing@student.com',
          status: 'active',
          departmentName: 'Science',
        },
      },
    ]);
    repository.findExistingByUniqueKeys = jest.fn().mockResolvedValue({
      byEmail: new Map([
        [
          'existing@student.com',
          {
            userId: 'usr-existing',
            email: 'existing@student.com',
            institutionsId: 'inst-1',
          },
        ],
      ]),
      byUserName: new Map(),
      byPhoneNumber: new Map(),
    });
    usersService.updateInstitutionManagedUser = jest.fn().mockResolvedValue(undefined);

    const result = await service.processUpload(
      {} as Express.Multer.File,
      {},
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    expect(result.updatedIds).toEqual([]);
    expect(result.createdIds).toEqual([]);
    expect(result.uploadOutcome).toBe('rejected');
    expect(usersService.updateInstitutionManagedUser).not.toHaveBeenCalled();
    expect(usersService.createInstitutionManagedUser).not.toHaveBeenCalled();
    expect(result.errors).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        code: 'ALREADY_LINKED_NO_CHANGE',
      }),
    ]);

    const decodedCsv = Buffer.from(result.reportCsvBase64 || '', 'base64').toString('utf8');
    expect(decodedCsv).toContain(
      'FAILURE,REJECTED,User already exists in this institution with the same details. Nothing to update.',
    );
  });

  it('still updates an already-linked user when updateExisting is explicitly true', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'Existing Student',
          phoneNumber: '+447912345678',
          email: 'existing@student.com',
          status: 'active',
          departmentName: 'Science',
        },
      },
    ]);
    repository.findExistingByUniqueKeys = jest.fn().mockResolvedValue({
      byEmail: new Map([
        [
          'existing@student.com',
          {
            userId: 'usr-existing',
            email: 'existing@student.com',
            institutionsId: 'inst-1',
          },
        ],
      ]),
      byUserName: new Map(),
      byPhoneNumber: new Map(),
    });
    usersService.updateInstitutionManagedUser = jest.fn().mockResolvedValue(undefined);

    const result = await service.processUpload(
      {} as Express.Multer.File,
      { updateExisting: true, skipExisting: false },
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );

    expect(result.updatedIds).toEqual(['usr-existing']);
    expect(usersService.updateInstitutionManagedUser).toHaveBeenCalledWith(
      'usr-existing',
      expect.any(Object),
    );
  });

  it('links phone-only existing user and sets email from bulk row', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'Phone Only',
          phoneNumber: '+447900000001',
          email: 'newmail@student.com',
          status: 'active',
          departmentName: 'Science',
        },
      },
    ]);
    repository.findExistingByUniqueKeys = jest.fn().mockResolvedValue({
      byEmail: new Map(),
      byUserName: new Map(),
      byPhoneNumber: new Map([
        [
          '+447900000001',
          { userId: 'usr-phone', phoneNumber: '+447900000001', institutionsId: undefined },
        ],
      ]),
    });
    usersService.updateInstitutionManagedUser = jest.fn().mockResolvedValue(undefined);

    const result = await service.processUpload(
      {} as Express.Multer.File,
      {},
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );

    expect(result.updatedIds).toEqual(['usr-phone']);
    expect(usersService.updateInstitutionManagedUser).toHaveBeenCalledWith(
      'usr-phone',
      expect.objectContaining({ email: 'newmail@student.com', institutionsId: 'inst-1' }),
    );
  });

  it('rejects when email and phone match different users', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'Conflict',
          phoneNumber: '+447900000002',
          email: 'conflict@student.com',
          status: 'active',
          departmentName: 'Science',
        },
      },
    ]);
    repository.findExistingByUniqueKeys = jest.fn().mockResolvedValue({
      byEmail: new Map([['conflict@student.com', { userId: 'usr-email', email: 'conflict@student.com' }]]),
      byUserName: new Map(),
      byPhoneNumber: new Map([
        ['+447900000002', { userId: 'usr-phone', phoneNumber: '+447900000002' }],
      ]),
    });

    const result = await service.processUpload(
      {} as Express.Multer.File,
      {},
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );

    expect(result.failureCount).toBe(1);
    expect(usersService.updateInstitutionManagedUser).not.toHaveBeenCalled();
    expect(usersService.createInstitutionManagedUser).not.toHaveBeenCalled();
  });

  it('fails rows with invalid status values', async () => {
    parser.parse = jest.fn().mockReturnValue([
      {
        rowNumber: 2,
        data: {
          name: 'Bad Status',
          phoneNumber: '+447999999999',
          status: 'not-valid',
          departmentName: 'Science',
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
      {},
      { institutionsId: 'inst-1', requestInstitutionsId: 'inst-1' },
    );

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(1);
    expect(result.uploadOutcome).toBe('failed');
    expect(usersService.createInstitutionManagedUser).not.toHaveBeenCalled();
  });
});
