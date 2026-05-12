import { BadRequestException, Injectable } from '@nestjs/common';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { ParsedUserUploadRow, UserBulkUploadErrorCode } from './user-bulk-upload.types';

const REQUIRED_COLUMNS = ['name', 'phoneNumber'];

const HEADER_ALIAS_MAP: Record<string, string> = {
  name: 'name',
  'student name': 'name',
  phonenumber: 'phoneNumber',
  'phone no': 'phoneNumber',
  email: 'email',
  'email id': 'email',
  username: 'userName',
  'user name': 'userName',
  status: 'status',
};

@Injectable()
export class UserBulkParser {
  private readonly allowedMimeTypes = new Set([
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);

  parse(file: Express.Multer.File): ParsedUserUploadRow[] {
    this.validateFile(file);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer', raw: false, cellDates: false });
    } catch {
      throw new BadRequestException({
        code: UserBulkUploadErrorCode.INVALID_FILE_FORMAT,
        message: 'Unable to parse file. Upload a valid csv or xlsx file.',
      });
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return [];
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(sheet, {
      defval: null,
      raw: false,
    });

    const rows = rawRows.map((row) => this.normalizeRowKeys(row));
    this.validateRequiredColumns(rows[0] || {});

    return rows.map((data, index) => ({
      rowNumber: index + 2,
      data,
    }));
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException({
        code: UserBulkUploadErrorCode.INVALID_FILE_FORMAT,
        message: 'File is required.',
      });
    }

    const extension = path.extname(file.originalname || '').toLowerCase();
    const isSupportedExtension = extension === '.csv' || extension === '.xlsx';
    const mimeTypeOk = this.allowedMimeTypes.has(file.mimetype);

    if (!isSupportedExtension || !mimeTypeOk) {
      throw new BadRequestException({
        code: UserBulkUploadErrorCode.INVALID_FILE_FORMAT,
        message: 'Only csv or xlsx files are supported.',
      });
    }
  }

  private validateRequiredColumns(row: Record<string, unknown>): void {
    const normalizedColumns = new Set(Object.keys(row).map((key) => key.trim()));
    const missingColumns = REQUIRED_COLUMNS.filter((column) => !normalizedColumns.has(column));
    if (missingColumns.length > 0) {
      throw new BadRequestException({
        code: UserBulkUploadErrorCode.INVALID_FILE_FORMAT,
        message: `Missing required columns: ${missingColumns.join(', ')}`,
      });
    }
  }

  private normalizeRowKeys(
    row: Record<string, string | number | null>,
  ): Record<string, string | number | null> {
    const normalized: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedHeader = key.trim().toLowerCase().replace(/\s+/g, ' ');
      const canonicalKey =
        HEADER_ALIAS_MAP[normalizedHeader] ||
        HEADER_ALIAS_MAP[normalizedHeader.replace(/\s/g, '')] ||
        key.trim();
      normalized[canonicalKey] = value;
    }
    return normalized;
  }
}
