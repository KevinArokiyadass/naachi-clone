import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { UserBulkUploadDto } from '../dto/user-bulk-upload.dto';
import { UsersAuthService } from '../users.service';
import { normalizeUserUploadRow } from './user-bulk-normalizer';
import { UserBulkParser } from './user-bulk-parser';
import { UserBulkRepository } from './user-bulk.repository';
import {
  NormalizedUserUploadRow,
  UserBulkUploadError,
  UserBulkUploadErrorCode,
  UserBulkUploadResult,
} from './user-bulk-upload.types';
import { UserBulkValidator } from './user-bulk-validator';

const DEFAULT_BATCH_SIZE = 50;
const MAX_ROWS = 5000;

type RowReportStatus = 'SUCCESS' | 'FAILURE';
type RowReportAction = 'CREATED' | 'UPDATED' | 'SKIPPED' | 'FAILED';

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
          const existingByPhone = row.phoneNumber
            ? existingMaps.byPhoneNumber.get(row.phoneNumber)
            : undefined;

          if (existingByPhone && skipExisting) {
            const duplicateReason = `User already exists for ${row.phoneNumber}.`;
            this.appendRowErrors(result, [
              this.toRowError(
                row.rowNumber,
                'phoneNumber',
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

          if (!existingByPhone) {
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

          if (updateExisting) {
            if (!dryRun) {
              await this.usersService.updateInstitutionManagedUser(existingByPhone.userId, {
                institutionsId: context.institutionsId,
                departmentsId: row.departmentsId,
                name: row.name!,
                email: row.email || undefined,
                userName: row.userName || undefined,
                status: effectiveStatus,
              });
              result.updatedIds.push(existingByPhone.userId);
            }
            result.successCount += 1;
            result.processedRows += 1;
            reportRows.push({
              rowNumber: row.rowNumber,
              phoneNumber: row.phoneNumber || '',
              email: row.email || '',
              status: 'SUCCESS',
              action: 'UPDATED',
              reason: dryRun ? 'Validated update (dry run).' : 'User updated successfully.',
            });
            continue;
          }

          const duplicateReason = `User already exists for ${row.phoneNumber}.`;
          this.appendRowErrors(result, [
            this.toRowError(
              row.rowNumber,
              'phoneNumber',
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

    return result;
  }

  private findDuplicatesInFile(rows: NormalizedUserUploadRow[]): Map<number, string> {
    const seenByPhone = new Map<string, number>();
    const duplicates = new Map<number, string>();

    for (const row of rows) {
      if (!row.phoneNumber) {
        continue;
      }
      const seenRow = seenByPhone.get(row.phoneNumber);
      if (seenRow) {
        duplicates.set(row.rowNumber, `Duplicate phoneNumber in file, first seen at row ${seenRow}.`);
      } else {
        seenByPhone.set(row.phoneNumber, row.rowNumber);
      }
    }
    return duplicates;
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
