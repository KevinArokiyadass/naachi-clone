import { Injectable } from '@nestjs/common';
import {
  NormalizedUserUploadRow,
  UserBulkUploadError,
  UserBulkUploadErrorCode,
} from './user-bulk-upload.types';

@Injectable()
export class UserBulkValidator {
  validateRow(row: NormalizedUserUploadRow): UserBulkUploadError[] {
    const errors: UserBulkUploadError[] = [];

    if (!row.name) {
      errors.push(
        this.error(
          row.rowNumber,
          'name',
          UserBulkUploadErrorCode.MISSING_REQUIRED_FIELD,
          'Name is required.',
        ),
      );
    }

    if (!row.phoneNumber) {
      errors.push(
        this.error(
          row.rowNumber,
          'phoneNumber',
          UserBulkUploadErrorCode.MISSING_REQUIRED_FIELD,
          'Phone number is required.',
        ),
      );
    } else if (!/^\+?\d{7,15}$/.test(row.phoneNumber)) {
      errors.push(
        this.error(
          row.rowNumber,
          'phoneNumber',
          UserBulkUploadErrorCode.INVALID_FIELD_FORMAT,
          'Phone number format is invalid.',
        ),
      );
    }

    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push(
        this.error(
          row.rowNumber,
          'email',
          UserBulkUploadErrorCode.INVALID_FIELD_FORMAT,
          'Email format is invalid.',
        ),
      );
    }

    if (row.userName && (row.userName.length < 3 || row.userName.length > 30)) {
      errors.push(
        this.error(
          row.rowNumber,
          'userName',
          UserBulkUploadErrorCode.INVALID_FIELD_FORMAT,
          'Username must be 3 to 30 characters.',
        ),
      );
    }

    if (row.rawStatus && row.status === null) {
      errors.push(
        this.error(
          row.rowNumber,
          'status',
          UserBulkUploadErrorCode.INVALID_FIELD_FORMAT,
          'Status must be active, blocked, or pending.',
        ),
      );
    }

    return errors;
  }

  private error(
    rowNumber: number,
    field: string,
    code: UserBulkUploadErrorCode,
    message: string,
  ): UserBulkUploadError {
    return { rowNumber, field, code, message };
  }
}
