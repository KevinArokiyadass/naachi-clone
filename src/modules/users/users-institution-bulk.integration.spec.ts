jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'mock-nanoid',
  nanoid: () => 'mock-nanoid',
}));

jest.mock('@noukha-technologies/mdm-core', () => ({
  RecordService: class RecordService {},
}));

import { ExecutionContext, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { RecordService } from '@noukha-technologies/mdm-core';
import { AdminUserService } from '../admin-users/admin-user.service';
import { ClientIdMiddleware } from '../../common/middleware/clientId.middlewere';
import { CognitoAuthGuard } from '../../common/middleware/cognito.authgaurd';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserBulkRateLimitGuard } from './bulk-upload/user-bulk-rate-limit.guard';
import { UserBulkUploadService } from './bulk-upload/user-bulk-upload.service';
import { UsersAuthService } from './users.service';
import { UsersInstitutionBulkController } from './users-institution-bulk.controller';

const TEST_ORIGIN = 'http://bulk-e2e.localhost:3000';
const TEST_INSTITUTIONS_ID = 'inst-e2e';

describe('UsersInstitutionBulkController (integration: middleware + guards)', () => {
  let app: INestApplication;
  let prevNaachiAdminUrl: string | undefined;

  const recordServiceMock = {
    findAll: jest.fn().mockImplementation(async (_model: string, opts: { filters?: { adminDomain?: string } }) => {
      expect(opts?.filters?.adminDomain).toBeDefined();
      return {
        items: [
          {
            institutionsId: TEST_INSTITUTIONS_ID,
            institutionName: 'E2E Institution',
          },
        ],
      };
    }),
  };

  const adminUserServiceMock = {
    getOneAdminUser: jest.fn().mockResolvedValue({
      userName: 'e2e-iadmin',
      role: 'INSTITUTION_ADMIN',
      status: 'active',
      metaTags: [{ institutionsId: TEST_INSTITUTIONS_ID, departmentsId: [] }],
    }),
  };

  const bulkUploadServiceMock = {
    processUpload: jest.fn().mockResolvedValue({
      totalRows: 0,
      processedRows: 0,
      successCount: 0,
      failureCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      errors: [],
      createdIds: [],
      updatedIds: [],
      dryRun: true,
    }),
  };

  const usersAuthServiceMock = {
    validateInstitutionScope: jest.fn(),
    getInstitutionBulkUploadTemplate: jest.fn().mockResolvedValue({
      fileName: `institution-student-bulk-upload-template-${TEST_INSTITUTIONS_ID}.xlsx`,
      fileBuffer: Buffer.from('xlsx-bytes'),
    }),
  };

  beforeAll(async () => {
    prevNaachiAdminUrl = process.env.NAACHI_ADMIN_URL;
    process.env.NAACHI_ADMIN_URL = JSON.stringify(['http://bulk-e2e-superadmin-only.invalid']);

    @Module({
      controllers: [UsersInstitutionBulkController],
      providers: [
        ClientIdMiddleware,
        CognitoAuthGuard,
        RolesGuard,
        UserBulkRateLimitGuard,
        { provide: RecordService, useValue: recordServiceMock },
        { provide: AdminUserService, useValue: adminUserServiceMock },
        { provide: UsersAuthService, useValue: usersAuthServiceMock },
        { provide: UserBulkUploadService, useValue: bulkUploadServiceMock },
      ],
    })
    class UsersInstitutionBulkIntegrationHostModule implements NestModule {
      configure(consumer: MiddlewareConsumer): void {
        consumer.apply(ClientIdMiddleware).forRoutes(UsersInstitutionBulkController);
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [UsersInstitutionBulkIntegrationHostModule],
    })
      .overrideGuard(CognitoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { username: 'e2e-iadmin' };
          return true;
        },
      })
      .overrideGuard(UserBulkRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (prevNaachiAdminUrl === undefined) {
      delete process.env.NAACHI_ADMIN_URL;
    } else {
      process.env.NAACHI_ADMIN_URL = prevNaachiAdminUrl;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects bulk upload when Origin is missing (ClientIdMiddleware before guards)', async () => {
    const csv = 'name,phoneNumber\nJohn,7912345678';
    await request(app.getHttpServer())
      .post(`/users/${TEST_INSTITUTIONS_ID}/bulk-upload`)
      .attach('file', Buffer.from(csv), 'students.csv')
      .field('dryRun', 'true')
      .expect(403);

    expect(recordServiceMock.findAll).not.toHaveBeenCalled();
    expect(bulkUploadServiceMock.processUpload).not.toHaveBeenCalled();
  });

  it('runs ClientIdMiddleware then RolesGuard: POST forwards institution context from Origin resolution', async () => {
    const csv = 'name,phoneNumber\nJohn,7912345678';
    await request(app.getHttpServer())
      .post(`/users/${TEST_INSTITUTIONS_ID}/bulk-upload`)
      .set('Origin', TEST_ORIGIN)
      .attach('file', Buffer.from(csv), 'students.csv')
      .field('dryRun', 'true')
      .expect(200);

    expect(recordServiceMock.findAll).toHaveBeenCalledWith(
      'institutions',
      expect.objectContaining({
        filters: expect.objectContaining({
          adminDomain: TEST_ORIGIN,
        }),
        nonPaginated: true,
      }),
    );

    expect(bulkUploadServiceMock.processUpload).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        institutionsId: TEST_INSTITUTIONS_ID,
        requestInstitutionsId: TEST_INSTITUTIONS_ID,
        isSuperAdminRequest: false,
      }),
    );
  });

  it('runs ClientIdMiddleware then RolesGuard: GET template uses scoped institution from Origin', async () => {
    await request(app.getHttpServer())
      .get(`/users/${TEST_INSTITUTIONS_ID}/bulk-upload/template`)
      .set('Origin', TEST_ORIGIN)
      .expect(200)
      .expect('Content-Type', /spreadsheetml/);

    expect(usersAuthServiceMock.validateInstitutionScope).toHaveBeenCalledWith(
      TEST_INSTITUTIONS_ID,
      expect.objectContaining({
        institutionsId: TEST_INSTITUTIONS_ID,
        isSuperAdminRequest: false,
      }),
    );
    expect(usersAuthServiceMock.getInstitutionBulkUploadTemplate).toHaveBeenCalledWith(
      TEST_INSTITUTIONS_ID,
    );
  });
});
