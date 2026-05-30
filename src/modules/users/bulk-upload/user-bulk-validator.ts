import { Injectable } from '@nestjs/common';
import {
  NormalizedUserUploadRow,
  UserBulkUploadError,
  UserBulkUploadErrorCode,
} from './user-bulk-upload.types';

const COUNTRY_PHONE_RULES: Record<string, number> = {
  '44': 10, 
  '91': 10,
};

const COUNTRY_CODES = ['91', '44'];

function isDigitsOnly(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

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
    } else {
      const raw = row.phoneNumber.trim();

      if (raw.length < 4) {
        errors.push(this.error(row.rowNumber, 'phoneNumber', UserBulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Invalid phone number.'));
      } else if (raw.charCodeAt(0) !== 43) { // '+'
        errors.push(this.error(row.rowNumber, 'phoneNumber', UserBulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Phone number must start with +.'));
      } else {
        const numberPart = raw.slice(1);

        if (numberPart.charCodeAt(0) === 43) {
          errors.push(this.error(row.rowNumber, 'phoneNumber', UserBulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Invalid phone number format.'));
        } else if (!isDigitsOnly(numberPart)) {
          errors.push(this.error(row.rowNumber, 'phoneNumber', UserBulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Phone number must contain digits only.'));
        } else {
          let matchedCode = '';
          for (const code of COUNTRY_CODES) {
            if (numberPart.startsWith(code)) {
              matchedCode = code;
              break;
            }
          }

          if (!matchedCode) {
            errors.push(this.error(row.rowNumber, 'phoneNumber', UserBulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Only +91 and +44 phone numbers are supported.'));
          } else {
            const national = numberPart.slice(matchedCode.length);
            const expectedLen = COUNTRY_PHONE_RULES[matchedCode];

            if (national.length !== expectedLen) {
              errors.push(
                this.error(
                  row.rowNumber,
                  'phoneNumber',
                  UserBulkUploadErrorCode.INVALID_FIELD_FORMAT,
                  `Phone number for +${matchedCode} must contain exactly ${expectedLen} digits.`,
                ),
              );
            } else if (matchedCode === '44' && national.charCodeAt(0) !== 55) { 
              errors.push(this.error(row.rowNumber, 'phoneNumber', UserBulkUploadErrorCode.INVALID_FIELD_FORMAT, 'UK mobile numbers must start with 7.'));
            } else if (matchedCode === '91') {
              const first = national.charCodeAt(0);
              if (first < 54 || first > 57) {
                errors.push(this.error(row.rowNumber, 'phoneNumber', UserBulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Indian mobile numbers must start with 6, 7, 8, or 9.'));
              }
            }
          }
        }
      }
    }

    if (!row.email) {
      errors.push(
        this.error(
          row.rowNumber,
          'email',
          UserBulkUploadErrorCode.MISSING_REQUIRED_FIELD,
          'Email is required.',
        ),
      );
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
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

    if (!row.departmentsId) {
      if (row.departmentName) {
        errors.push(
          this.error(
            row.rowNumber,
            'departmentName',
            UserBulkUploadErrorCode.INVALID_FIELD_FORMAT,
            `Department '${row.departmentName}' does not exist.`,
          ),
        );
      } else {
        errors.push(
          this.error(
            row.rowNumber,
            'departmentName',
            UserBulkUploadErrorCode.MISSING_REQUIRED_FIELD,
            'Department is required.',
          ),
        );
      }
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
