import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { assignBulkUploadOutcome } from '../../../common/utils/bulk-upload-outcome.util';
import { UserBulkUploadDto } from '../dto/user-bulk-upload.dto';
import { UsersAuthService } from '../users.service';
import { normalizeUserUploadRow } from './user-bulk-normalizer';
import { UserBulkParser } from './user-bulk-parser';
import { UserBulkRepository } from './user-bulk.repository';
import {
  ExistingUserLookupMaps,
  ExistingUserRecord,
  NormalizedUserUploadRow,
  UserBulkUploadError,
  UserBulkUploadErrorCode,
  UserBulkUploadResult,
} from './user-bulk-upload.types';
import { UserBulkValidator } from './user-bulk-validator';

const DEFAULT_BATCH_SIZE = 50;
const MAX_ROWS = 5000;

type RowReportStatus = 'SUCCESS' | 'FAILURE';
type RowReportAction = 'CREATED' | 'UPDATED' | 'SKIPPED' | 'REJECTED' | 'FAILED';

interface RowReportEntry {
  rowNumber: number;
  phoneNumber: string;
  email: string;
  status: RowReportStatus;
  action: RowReportAction;
  reason: string;
}

@Injectable()
export class UserBulkUploadService {
  private readonly logger = new Logger(UserBulkUploadService.name);

  constructor(
    private readonly parser: UserBulkParser,
    private readonly validator: UserBulkValidator,
    private readonly repository: UserBulkRepository,
    private readonly usersService: UsersAuthService,
  ) {}

  async processUpload(
    file: Express.Multer.File,
    options: UserBulkUploadDto,
    context: {
      institutionsId: string;
      requestInstitutionsId?: string;
      isSuperAdminRequest?: boolean;
    },
  ): Promise<UserBulkUploadResult> {
    const dryRun = Boolean(options.dryRun);
    const skipExisting = options.skipExisting ?? true;
    const updateExisting = options.updateExisting ?? false;
    const includeCsvReport = options.includeCsvReport ?? true;
    const reportRows: RowReportEntry[] = [];

    if (skipExisting && updateExisting) {
      throw new BadRequestException('Only one of skipExisting or updateExisting can be true.');
    }

    const parsedRows = this.parser.parse(file);
    if (parsedRows.length > MAX_ROWS) {
      throw new BadRequestException(`Maximum ${MAX_ROWS} rows are allowed per upload.`);
    }

    this.usersService.validateInstitutionScope(context.institutionsId, {
      institutionsId: context.requestInstitutionsId,
      isSuperAdminRequest: context.isSuperAdminRequest,
    });

    await this.usersService.assertBulkUploadUserLimitNotExceeded();

    const institutionOptions = await this.usersService.getBulkUploadOptions(context.institutionsId);
    const departmentNameToId = new Map(
      institutionOptions.departments
        .filter((item) => item?.departmentName && item?.departmentsId)
        .map((item) => [item.departmentName.trim().toLowerCase(), item.departmentsId]),
    );

    const normalizedRows = parsedRows.map((row) => {
      const normalized = normalizeUserUploadRow(row);
      normalized.phoneNumber = this.withDefaultCountryCode(normalized.phoneNumber);
      return normalized;
    });

    const result: UserBulkUploadResult = {
      totalRows: normalizedRows.length,
      processedRows: 0,
      successCount: 0,
      failureCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      errors: [],
      createdIds: [],
      updatedIds: [],
      dryRun,
    };

    const duplicateRowsInFile = this.findDuplicatesInFile(normalizedRows);
    if (duplicateRowsInFile.size) {
      for (const [rowNumber, message] of duplicateRowsInFile.entries()) {
        const sourceRow = normalizedRows.find((row) => row.rowNumber === rowNumber);
        result.errors.push({
          rowNumber,
          field: 'phoneNumber',
          code: UserBulkUploadErrorCode.DUPLICATE_IN_FILE,
          message,
        });
        reportRows.push({
          rowNumber,
          phoneNumber: sourceRow?.phoneNumber || '',
          email: sourceRow?.email || '',
          status: 'FAILURE',
          action: 'FAILED',
          reason: message,
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
      this.logger.log(`users bulk upload batch start. rows=${batch.length}, start=${index + 1}`);

      for (const row of batch) {
        if (!row.departmentsId && row.departmentName) {
          const mappedDepartment = departmentNameToId.get(row.departmentName.trim().toLowerCase());
          if (mappedDepartment) {
            row.departmentsId = mappedDepartment;
          }
        }

        const rowErrors = this.validator.validateRow(row);
        if (rowErrors.length) {
          this.appendRowErrors(result, rowErrors);
          reportRows.push({
            rowNumber: row.rowNumber,
            phoneNumber: row.phoneNumber || '',
            email: row.email || '',
            status: 'FAILURE',
            action: 'FAILED',
            reason: rowErrors.map((e) => e.message).join(' | '),
          });
          continue;
        }

        const effectiveStatus = row.status ?? 'active';

        try {
          const resolution = this.resolveExistingUser(row, existingMaps);
          if (resolution.conflict) {
            this.appendRowErrors(result, [
              this.toRowError(
                row.rowNumber,
                'email',
                UserBulkUploadErrorCode.BUSINESS_RULE_VIOLATION,
                resolution.conflict,
              ),
            ]);
            reportRows.push({
              rowNumber: row.rowNumber,
              phoneNumber: row.phoneNumber || '',
              email: row.email || '',
              status: 'FAILURE',
              action: 'FAILED',
              reason: resolution.conflict,
            });
            continue;
          }

          const existing = resolution.user;

          if (
            existing &&
            !updateExisting &&
            this.isUserAlreadyInInstitution(existing, context.institutionsId)
          ) {
            this.recordAlreadyLinkedRejection(result, reportRows, row);
            continue;
          }

          const shouldLinkExisting =
            existing && (this.shouldAutoLinkExistingUser(existing, row) || updateExisting);

          if (existing && shouldLinkExisting) {
            if (
              existing.institutionsId?.trim() &&
              existing.institutionsId.trim() !== context.institutionsId.trim()
            ) {
              const institutionConflict =
                'User is already assigned to another institution.';
              this.appendRowErrors(result, [
                this.toRowError(
                  row.rowNumber,
                  'email',
                  UserBulkUploadErrorCode.BUSINESS_RULE_VIOLATION,
                  institutionConflict,
                ),
              ]);
              reportRows.push({
                rowNumber: row.rowNumber,
                phoneNumber: row.phoneNumber || '',
                email: row.email || '',
                status: 'FAILURE',
                action: 'FAILED',
                reason: institutionConflict,
              });
              continue;
            }

            if (!dryRun) {
              await this.usersService.updateInstitutionManagedUser(existing.userId, {
                institutionsId: context.institutionsId,
                departmentsId: row.departmentsId,
                name: row.name!,
                email: row.email || undefined,
                userName: row.userName || undefined,
                status: effectiveStatus,
              });
              result.updatedIds.push(existing.userId);
            }
            result.successCount += 1;
            result.processedRows += 1;
            const linkReason = this.describeLinkReason(existing, row);
            reportRows.push({
              rowNumber: row.rowNumber,
              phoneNumber: row.phoneNumber || '',
              email: row.email || '',
              status: 'SUCCESS',
              action: 'UPDATED',
              reason: dryRun ? `Validated link (dry run): ${linkReason}` : linkReason,
            });
            continue;
          }

          if (existing && skipExisting) {
            const duplicateReason = row.email
              ? `User already exists for ${row.email}.`
              : `User already exists for ${row.phoneNumber}.`;
            this.appendRowErrors(result, [
              this.toRowError(
                row.rowNumber,
                row.email ? 'email' : 'phoneNumber',
                UserBulkUploadErrorCode.DUPLICATE_IN_DB,
                duplicateReason,
              ),
            ]);
            reportRows.push({
              rowNumber: row.rowNumber,
              phoneNumber: row.phoneNumber || '',
              email: row.email || '',
              status: 'FAILURE',
              action: 'SKIPPED',
              reason: duplicateReason,
            });
            result.duplicateCount += 1;
            continue;
          }

          if (!existing) {
            if (!dryRun) {
              const created = await this.usersService.createInstitutionManagedUser({
                institutionsId: context.institutionsId,
                departmentsId: row.departmentsId,
                name: row.name!,
                phoneNumber: row.phoneNumber!,
                email: row.email || undefined,
                userName: row.userName || undefined,
                status: effectiveStatus,
              });
              if (created?.userId) {
                result.createdIds.push(created.userId);
              }
            }
            result.successCount += 1;
            result.processedRows += 1;
            reportRows.push({
              rowNumber: row.rowNumber,
              phoneNumber: row.phoneNumber || '',
              email: row.email || '',
              status: 'SUCCESS',
              action: 'CREATED',
              reason: dryRun ? 'Validated successfully (dry run).' : 'User created successfully.',
            });
            continue;
          }

          const duplicateReason = row.email
            ? `User already exists for ${row.email}.`
            : `User already exists for ${row.phoneNumber}.`;
          this.appendRowErrors(result, [
            this.toRowError(
              row.rowNumber,
              row.email ? 'email' : 'phoneNumber',
              UserBulkUploadErrorCode.DUPLICATE_IN_DB,
              duplicateReason,
            ),
          ]);
          reportRows.push({
            rowNumber: row.rowNumber,
            phoneNumber: row.phoneNumber || '',
            email: row.email || '',
            status: 'FAILURE',
            action: 'FAILED',
            reason: duplicateReason,
          });
          result.duplicateCount += 1;
        } catch (error: any) {
          const errorMessage = error?.response?.message || error?.message || 'Failed to process this row.';
          const processingReason = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
          this.appendRowErrors(result, [
            this.toRowError(
              row.rowNumber,
              'row',
              UserBulkUploadErrorCode.INTERNAL_PROCESSING_ERROR,
              processingReason,
            ),
          ]);
          reportRows.push({
            rowNumber: row.rowNumber,
            phoneNumber: row.phoneNumber || '',
            email: row.email || '',
            status: 'FAILURE',
            action: 'FAILED',
            reason: processingReason,
          });
          this.logger.error(`users bulk row failed rowNumber=${row.rowNumber}`, (error as Error)?.stack);
        }
      }
      this.logger.log(`users bulk upload batch completed. rows=${batch.length}, start=${index + 1}`);
    }

    result.processedRows = result.successCount + result.failureCount;
    if (includeCsvReport) {
      result.reportFileName = `user-bulk-upload-report-${context.institutionsId}-${Date.now()}.csv`;
      result.reportCsvBase64 = Buffer.from(this.toCsv(reportRows), 'utf8').toString('base64');
    }

    if (result.failureCount > 0) {
      try {
        const { Workbook } = await import('exceljs');
        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Rejected Users');

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
        result.rejectedExcelFileName = `rejected-users-${context.institutionsId}-${Date.now()}.xlsx`;
        result.rejectedExcelBase64 = Buffer.from(buffer).toString('base64');
      } catch (excelErr) {
        this.logger.error('Failed to generate rejected excel workbook', (excelErr as Error)?.stack);
      }
    }

    return assignBulkUploadOutcome(result);
  }

  private findDuplicatesInFile(rows: NormalizedUserUploadRow[]): Map<number, string> {
    const seenByEmail = new Map<string, number>();
    const seenByPhone = new Map<string, number>();
    const duplicates = new Map<number, string>();

    for (const row of rows) {
      if (row.email) {
        const seenEmailRow = seenByEmail.get(row.email);
        if (seenEmailRow) {
          duplicates.set(
            row.rowNumber,
            `Duplicate email in file, first seen at row ${seenEmailRow}.`,
          );
          continue;
        }
        seenByEmail.set(row.email, row.rowNumber);
      }

      if (!row.phoneNumber) {
        continue;
      }
      const seenPhoneRow = seenByPhone.get(row.phoneNumber);
      if (seenPhoneRow) {
        duplicates.set(
          row.rowNumber,
          `Duplicate phoneNumber in file, first seen at row ${seenPhoneRow}.`,
        );
      } else {
        seenByPhone.set(row.phoneNumber, row.rowNumber);
      }
    }
    return duplicates;
  }

  /**
   * Email is the primary identity for bulk rows; phone is a secondary match when email is absent on the stored user.
   */
  private resolveExistingUser(
    row: NormalizedUserUploadRow,
    maps: ExistingUserLookupMaps,
  ): { user?: ExistingUserRecord; conflict?: string } {
    const existingByEmail = row.email ? maps.byEmail.get(row.email) : undefined;
    const existingByPhone = row.phoneNumber
      ? maps.byPhoneNumber.get(row.phoneNumber)
      : undefined;

    if (
      existingByEmail &&
      existingByPhone &&
      existingByEmail.userId !== existingByPhone.userId
    ) {
      return {
        conflict:
          'Email and phone number belong to different existing users. Resolve the conflict before uploading.',
      };
    }

    if (existingByEmail) {
      return { user: existingByEmail };
    }

    if (existingByPhone) {
      const storedEmail = existingByPhone.email?.trim().toLowerCase();
      if (storedEmail && row.email && storedEmail !== row.email) {
        return {
          conflict: `Phone number is already registered with a different email (${existingByPhone.email}).`,
        };
      }
      return { user: existingByPhone };
    }

    return {};
  }

  private isUserAlreadyInInstitution(
    existing: ExistingUserRecord,
    targetInstitutionsId: string,
  ): boolean {
    const linkedInstitutionId = existing.institutionsId?.trim();
    const targetId = targetInstitutionsId.trim();
    return Boolean(linkedInstitutionId && targetId && linkedInstitutionId === targetId);
  }

  private recordAlreadyLinkedRejection(
    result: UserBulkUploadResult,
    reportRows: RowReportEntry[],
    row: NormalizedUserUploadRow,
  ): void {
    const reason =
      'User already exists in this institution with the same details. Nothing to update.';
    result.errors.push({
      rowNumber: row.rowNumber,
      field: row.email ? 'email' : 'phoneNumber',
      code: UserBulkUploadErrorCode.ALREADY_LINKED_NO_CHANGE,
      message: reason,
    });
    result.failureCount += 1;
    result.processedRows += 1;
    result.rejectedCount += 1;
    reportRows.push({
      rowNumber: row.rowNumber,
      phoneNumber: row.phoneNumber || '',
      email: row.email || '',
      status: 'FAILURE',
      action: 'REJECTED',
      reason,
    });
  }

  /**
   * Link an existing global (or email-less) user to the target institution instead of treating the row as a duplicate.
   */
  private shouldAutoLinkExistingUser(
    existing: ExistingUserRecord,
    row: NormalizedUserUploadRow,
  ): boolean {
    if (row.email && existing.email?.trim().toLowerCase() === row.email) {
      return true;
    }
    if (!existing.email && row.email) {
      return true;
    }
    if (!existing.institutionsId) {
      return true;
    }
    return false;
  }

  private describeLinkReason(existing: ExistingUserRecord, row: NormalizedUserUploadRow): string {
    if (!existing.institutionsId) {
      return 'Existing global user linked to institution.';
    }
    if (!existing.email && row.email) {
      return 'Existing user updated with email and linked to institution.';
    }
    return 'Existing user linked to institution.';
  }

  private appendRowErrors(result: UserBulkUploadResult, errors: UserBulkUploadError[]): void {
    result.errors.push(...errors);
    result.failureCount += 1;
    result.processedRows += 1;
  }

  private toRowError(
    rowNumber: number,
    field: string,
    code: UserBulkUploadErrorCode,
    message: string,
  ): UserBulkUploadError {
    return { rowNumber, field, code, message };
  }

  private withDefaultCountryCode(phoneNumber: string | null): string | null {
    if (!phoneNumber) {
      return null;
    }
    const normalized = phoneNumber.trim();
    return normalized || null;
  }

  private toCsv(rows: RowReportEntry[]): string {
    const headers = ['rowNumber', 'phoneNumber', 'email', 'status', 'action', 'reason'];
    const body = rows.map((row) => [
      row.rowNumber,
      row.phoneNumber,
      row.email,
      row.status,
      row.action,
      row.reason,
    ]);
    return [headers, ...body]
      .map((line) => line.map((value) => this.escapeCsv(value)).join(','))
      .join('\n');
  }

  private escapeCsv(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
