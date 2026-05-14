import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CognitoAuthGuard } from '../../common/middleware/cognito.authgaurd';
import { AdminUserBulkRateLimitGuard } from './bulk-upload/admin-user-bulk-rate-limit.guard';
import { AdminUserBulkUploadService } from './bulk-upload/admin-user-bulk-upload.service';
import { AdminUserController } from './admin-user.controller';
import { AdminUserService } from './admin-user.service';

jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'mock-id',
}));

describe('AdminUserController bulk upload', () => {
  let app: INestApplication;

  const bulkServiceMock = {
    processUpload: jest.fn().mockResolvedValue({
      totalRows: 1,
      processedRows: 1,
      successCount: 1,
      failureCount: 0,
      duplicateCount: 0,
      errors: [],
      createdIds: ['adm-1'],
      updatedIds: [],
      dryRun: false,
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminUserController],
      providers: [
        { provide: AdminUserService, useValue: {} },
        { provide: AdminUserBulkUploadService, useValue: bulkServiceMock },
      ],
    })
      .overrideGuard(CognitoAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminUserBulkRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts multipart upload', async () => {
    const csv = 'email,password,role,name\njohn@naachi.com,Password123,ADMIN,John';
    await request(app.getHttpServer())
      .post('/admin-user/bulk-upload')
      .attach('file', Buffer.from(csv), 'admins.csv')
      .field('dryRun', 'true')
      .expect(200);

    expect(bulkServiceMock.processUpload).toHaveBeenCalled();
  });

  it('returns 422 when no rows succeed', async () => {
    bulkServiceMock.processUpload = jest.fn().mockResolvedValue({
      totalRows: 1,
      processedRows: 1,
      successCount: 0,
      failureCount: 1,
      duplicateCount: 0,
      errors: [
        {
          rowNumber: 2,
          field: 'email',
          code: 'MISSING_REQUIRED_FIELD',
          message: 'Email is required.',
        },
      ],
      createdIds: [],
      updatedIds: [],
      dryRun: false,
      uploadOutcome: 'failed',
    });

    const csv =
      'name,phoneNumber,email,permissionGroupName,departmentName,password,confirmPassword\n' +
      'Jane,+447912345678,,Marketing,Operations,Password@123,Password@123';
    await request(app.getHttpServer())
      .post('/admin-user/bulk-upload')
      .attach('file', Buffer.from(csv), 'admins.csv')
      .expect(422);
  });
});

