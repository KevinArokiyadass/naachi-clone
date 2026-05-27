import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CognitoAuthGuard } from '../../common/middleware/cognito.authgaurd';
import { UserBulkRateLimitGuard } from './bulk-upload/user-bulk-rate-limit.guard';
import { UserBulkUploadService } from './bulk-upload/user-bulk-upload.service';
import { UsersInstitutionBulkController } from './users-institution-bulk.controller';
import { UsersAuthService } from './users.service';

jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'mock-id',
}));

describe('UsersInstitutionBulkController bulk upload', () => {
  let app: INestApplication;

  const bulkServiceMock = {
    processUpload: jest.fn().mockResolvedValue({
      totalRows: 1,
      processedRows: 1,
      successCount: 1,
      failureCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      errors: [],
      createdIds: ['usr-1'],
      updatedIds: [],
      dryRun: false,
      reportFileName: 'user-bulk-upload-report-inst-1.csv',
      reportCsvBase64: Buffer.from('rowNumber,phoneNumber\n2,+447912345678').toString('base64'),
    }),
  };

  const usersServiceMock = {
    validateInstitutionScope: jest.fn(),
    getInstitutionBulkUploadTemplate: jest.fn().mockResolvedValue({
      fileName: 'institution-student-bulk-upload-template-inst-1.xlsx',
      fileBuffer: Buffer.from('fake-xlsx'),
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersInstitutionBulkController],
      providers: [
        { provide: UsersAuthService, useValue: usersServiceMock },
        { provide: UserBulkUploadService, useValue: bulkServiceMock },
      ],
    })
      .overrideGuard(CognitoAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(UserBulkRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts users multipart upload', async () => {
    const csv = 'name,phoneNumber\nJohn Student,7912345678';
    await request(app.getHttpServer())
      .post('/users/inst-1/bulk-upload')
      .attach('file', Buffer.from(csv), 'students.csv')
      .field('dryRun', 'true')
      .expect(200);

    expect(bulkServiceMock.processUpload).toHaveBeenCalled();
  });
});
