import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AdminRoles } from '../../../common/enums/user.enum';
import { AdminUserService } from '../admin-user.service';
import { AdminUserBulkUploadDto } from '../dto/admin-user-bulk-upload.dto';
import { CreateAdminWithPasswordDto } from '../dto/create-admin-with-password.dto';
import { AdminUserBulkMetricsService } from './admin-user-bulk-metrics.service';
import { normalizeAdminUserUploadRow } from './admin-user-bulk-normalizer';
import { AdminUserBulkParser } from './admin-user-bulk-parser';
import { AdminUserBulkRepository } from './admin-user-bulk.repository';
import {
  AdminUserBulkUploadError,
  AdminUserBulkUploadResult,
  BulkUploadErrorCode,
  NormalizedAdminUserUploadRow,
} from './admin-user-bulk-upload.types';
import { AdminUserBulkValidator } from './admin-user-bulk-validator';

const DEFAULT_BATCH_SIZE = 50;
const MAX_ROWS = 5000;

@Injectable()
export class AdminUserBulkUploadService {
  private readonly logger = new Logger(AdminUserBulkUploadService.name);

  constructor(
    private readonly parser: AdminUserBulkParser,
    private readonly validator: AdminUserBulkValidator,
    private readonly repository: AdminUserBulkRepository,
    private readonly adminUserService: AdminUserService,
    private readonly metrics: AdminUserBulkMetricsService,
  ) {}

  async processUpload(
    file: Express.Multer.File,
    options: AdminUserBulkUploadDto,
    context?: {
      institutionsId?: string;
      requestInstitutionsId?: string;
      isSuperAdminRequest?: boolean;
    },
  ): Promise<AdminUserBulkUploadResult> {
    this.metrics.increment('upload_started');
    const dryRun = Boolean(options.dryRun);
    const skipExisting = options.skipExisting ?? true;
    const updateExisting = options.updateExisting ?? false;
    const reportRows: { rowNumber: number; reason: string; status: 'SUCCESS' | 'FAILURE' }[] = [];

    if (skipExisting && updateExisting) {
      throw new BadRequestException('Only one of skipExisting or updateExisting can be true.');
    }

    const parsedRows = this.parser.parse(file);
    if (parsedRows.length > MAX_ROWS) {
      throw new BadRequestException(`Maximum ${MAX_ROWS} rows are allowed per upload.`);
    }

    const normalizedRows = parsedRows.map((row) => normalizeAdminUserUploadRow(row));
    const institutionsId = context?.institutionsId || context?.requestInstitutionsId;
    if (!institutionsId) {
      throw new BadRequestException('institutionsId is required in URL for bulk upload.');
    }

    this.adminUserService.validateInstitutionScope(institutionsId, {
      institutionsId: context?.requestInstitutionsId,
      isSuperAdminRequest: context?.isSuperAdminRequest,
    });

    const institutionOptions = await this.adminUserService.getBulkUploadOptions(institutionsId);
    const permissionNameToId = new Map(
      institutionOptions.permissions
        .filter((item) => item?.name && item?.permissionGroupsId)
        .map((item) => [item.name.trim().toLowerCase(), item.permissionGroupsId]),
    );
    const departmentNameToId = new Map(
      institutionOptions.departments
        .filter((item) => item?.departmentName && item?.departmentsId)
        .map((item) => [item.departmentName.trim().toLowerCase(), item.departmentsId]),
    );
    const result: AdminUserBulkUploadResult = {
      totalRows: normalizedRows.length,
      processedRows: 0,
      successCount: 0,
      failureCount: 0,
      duplicateCount: 0,
      errors: [],
      createdIds: [],
      updatedIds: [],
      dryRun,
    };

    const duplicateRowsInFile = this.findDuplicatesInFile(normalizedRows);
    if (duplicateRowsInFile.size) {
      for (const [rowNumber, message] of duplicateRowsInFile.entries()) {
        result.errors.push({
          rowNumber,
          field: 'email',
          code: BulkUploadErrorCode.DUPLICATE_IN_FILE,
          message,
        });
        reportRows.push({
          rowNumber,
          reason: message,
          status: 'FAILURE',
        });
        result.failureCount += 1;
        result.duplicateCount += 1;
      }
    }

    const candidateRows = normalizedRows.filter((row) => !duplicateRowsInFile.has(row.rowNumber));
    const existingMaps = await this.repository.findExistingByUniqueKeys(
      candidateRows.map((row) => row.email).filter((value): value is string => Boolean(value)),
      candidateRows.map((row) => row.userName).filter((value): value is string => Boolean(value)),
      candidateRows.map((row) => row.phoneNumber).filter((value): value is string => Boolean(value)),
    );

    for (let index = 0; index < candidateRows.length; index += DEFAULT_BATCH_SIZE) {
      const batch = candidateRows.slice(index, index + DEFAULT_BATCH_SIZE);
      this.logger.log(`admin-user bulk upload batch start. rows=${batch.length}, start=${index + 1}`);

      for (const row of batch) {
        row.role = row.role || AdminRoles.INSTITUTIONADMIN;
        row.institutionsId = institutionsId;
        row.phoneNumber = this.withDefaultCountryCode(row.phoneNumber);
        this.mapInstitutionScopedFields(row, permissionNameToId, departmentNameToId);

        const rowErrors = this.validator.validateRow(row);
        if (rowErrors.length) {
          this.appendRowErrors(result, rowErrors);
          reportRows.push({
            rowNumber: row.rowNumber,
            reason: rowErrors.map((e) => e.message).join('; '),
            status: 'FAILURE',
          });
          continue;
        }

        try {
          const existingByEmail = row.email ? existingMaps.byEmail.get(row.email) : undefined;
          if (existingByEmail && skipExisting) {
            const reason = `Admin already exists for ${row.email}.`;
            this.appendRowErrors(result, [
              this.toRowError(row.rowNumber, 'email', BulkUploadErrorCode.DUPLICATE_IN_DB, reason),
            ]);
            reportRows.push({
              rowNumber: row.rowNumber,
              reason,
              status: 'FAILURE',
            });
            result.duplicateCount += 1;
            continue;
          }

          if (!existingByEmail) {
            if (!dryRun) {
              const created = await this.adminUserService.createAdminUser(this.toCreateDto(row));
              if (created?.adminUser?.adminId) {
                result.createdIds.push(created.adminUser.adminId);
              }
            }
            result.successCount += 1;
            result.processedRows += 1;
            reportRows.push({
              rowNumber: row.rowNumber,
              reason: '',
              status: 'SUCCESS',
            });
            continue;
          }

          if (updateExisting) {
            if (!dryRun) {
              await this.adminUserService.update(existingByEmail.adminId, this.toUpdatePayload(row));
              result.updatedIds.push(existingByEmail.adminId);
            }
            result.successCount += 1;
            result.processedRows += 1;
            reportRows.push({
              rowNumber: row.rowNumber,
              reason: '',
              status: 'SUCCESS',
            });
            continue;
          }

          const reason = `Admin already exists for ${row.email}.`;
          this.appendRowErrors(result, [
            this.toRowError(row.rowNumber, 'email', BulkUploadErrorCode.DUPLICATE_IN_DB, reason),
          ]);
          reportRows.push({
            rowNumber: row.rowNumber,
            reason,
            status: 'FAILURE',
          });
          result.duplicateCount += 1;
        } catch (error: any) {
          const errorMessage = error?.response?.message || error?.message || 'Failed to process this row.';
          const reason = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
          this.appendRowErrors(result, [
            this.toRowError(
              row.rowNumber,
              'row',
              BulkUploadErrorCode.INTERNAL_PROCESSING_ERROR,
              reason,
            ),
          ]);
          reportRows.push({
            rowNumber: row.rowNumber,
            reason,
            status: 'FAILURE',
          });
          this.logger.error(`admin-user bulk row failed rowNumber=${row.rowNumber}`, error?.stack);
        }
      }

      this.logger.log(`admin-user bulk upload batch completed. rows=${batch.length}, start=${index + 1}`);
    }

    result.processedRows = result.successCount + result.failureCount;

    if (result.failureCount > 0) {
      try {
        const { Workbook } = await import('exceljs');
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Rejected Admins');

        const allHeaders = new Set<string>();
        for (const row of parsedRows) {
          for (const key of Object.keys(row.data)) {
            allHeaders.add(key);
          }
        }
        const columns = Array.from(allHeaders);

        worksheet.columns = [
          ...columns.map((col) => ({
            header: col.charAt(0).toUpperCase() + col.slice(1),
            key: col,
            width: 22,
          })),
          { header: 'Reason', key: 'reason', width: 45 },
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF8400' },
        };

        for (const report of reportRows) {
          if (report.status === 'FAILURE') {
            const matchedParsed = parsedRows.find((p) => p.rowNumber === report.rowNumber);
            const rowData: Record<string, any> = matchedParsed ? { ...matchedParsed.data } : {};
            rowData['reason'] = report.reason;
            worksheet.addRow(rowData);
          }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        result.rejectedExcelFileName = `rejected-admins-${institutionsId}-${Date.now()}.xlsx`;
        result.rejectedExcelBase64 = Buffer.from(buffer).toString('base64');
      } catch (excelErr) {
        this.logger.error('Failed to generate rejected excel workbook', (excelErr as Error)?.stack);
      }

      this.metrics.increment('upload_failed');
      this.metrics.increment('rows_failed_total', result.failureCount);
      for (const error of result.errors) {
        this.metrics.increment(`rows_failed_${error.code.toLowerCase()}`);
      }
    } else {
      this.metrics.increment('upload_succeeded');
    }

    return result;
  }

  private findDuplicatesInFile(rows: NormalizedAdminUserUploadRow[]): Map<number, string> {
    const seenByEmail = new Map<string, number>();
    const duplicates = new Map<number, string>();

    for (const row of rows) {
      if (!row.email) {
        continue;
      }
      const seenRow = seenByEmail.get(row.email);
      if (seenRow) {
        duplicates.set(row.rowNumber, `Duplicate email in file, first seen at row ${seenRow}.`);
      } else {
        seenByEmail.set(row.email, row.rowNumber);
      }
    }
    return duplicates;
  }

  private toCreateDto(row: NormalizedAdminUserUploadRow): CreateAdminWithPasswordDto {
    const name = row.name || [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
    return {
      name: name!,
      firstName: row.firstName || undefined,
      lastName: row.lastName || undefined,
      email: row.email!,
      userName: row.userName || undefined,
      password: row.password!,
      phoneNumber: row.phoneNumber || undefined,
      role: row.role!,
      status: row.status || 'active',
      permissionGroupsId: row.permissionGroupsId,
      metaTags: row.institutionsId
        ? [{ institutionsId: row.institutionsId, departmentsId: row.departmentsId }]
        : undefined,
      s3ProfileImageName: row.s3ProfileImageName || undefined,
      skipDomainValidation: true,
    } as any;
  }

  private toUpdatePayload(row: NormalizedAdminUserUploadRow): Record<string, unknown> {
    const name = row.name || [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
    return {
      name,
      email: row.email!,
      phoneNumber: row.phoneNumber || undefined,
      userName: row.userName || undefined,
      role: row.role!,
      status: row.status || 'active',
      permissionGroupsId: row.permissionGroupsId,
      metaTags: row.institutionsId
        ? [{ institutionsId: row.institutionsId, departmentsId: row.departmentsId }]
        : undefined,
      s3FileName: row.s3ProfileImageName || undefined,
    };
  }

  private appendRowErrors(result: AdminUserBulkUploadResult, errors: AdminUserBulkUploadError[]): void {
    result.errors.push(...errors);
    result.failureCount += 1;
    result.processedRows += 1;
  }

  private toRowError(rowNumber: number, field: string, code: BulkUploadErrorCode, message: string): AdminUserBulkUploadError {
    return { rowNumber, field, code, message };
  }

  private withDefaultCountryCode(phoneNumber: string | null): string | null {
    if (!phoneNumber) {
      return null;
    }
    const normalized = phoneNumber.trim();
    return normalized || null;
  }

  private mapInstitutionScopedFields(
    row: NormalizedAdminUserUploadRow,
    permissionNameToId: Map<string, string>,
    departmentNameToId: Map<string, string>,
  ): void {
    if (row.permissionGroupsId.length === 0 && row.permissionGroupName) {
      const mappedPermission = permissionNameToId.get(row.permissionGroupName.trim().toLowerCase());
      if (mappedPermission) {
        row.permissionGroupsId = [mappedPermission];
      }
    }

    if (row.departmentsId.length === 0 && row.departmentName) {
      const mappedDepartment = departmentNameToId.get(row.departmentName.trim().toLowerCase());
      if (mappedDepartment) {
        row.departmentsId = [mappedDepartment];
      }
    }
  }
}

