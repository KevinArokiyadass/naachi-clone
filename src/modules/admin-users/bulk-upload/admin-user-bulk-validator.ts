import { Injectable } from '@nestjs/common';
import { AdminRoles } from '../../../common/enums/user.enum';
import { BulkUploadErrorCode, NormalizedAdminUserUploadRow, AdminUserBulkUploadError } from './admin-user-bulk-upload.types';

@Injectable()
export class AdminUserBulkValidator {
  validateRow(row: NormalizedAdminUserUploadRow): AdminUserBulkUploadError[] {
    const errors: AdminUserBulkUploadError[] = [];
    const fullName = row.name || [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || null;

    if (!fullName) {
      errors.push(this.error(row.rowNumber, 'name', BulkUploadErrorCode.MISSING_REQUIRED_FIELD, 'Provide either name or firstName and lastName.'));
    }

    if (!row.email) {
      errors.push(this.error(row.rowNumber, 'email', BulkUploadErrorCode.MISSING_REQUIRED_FIELD, 'Email is required.'));
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push(this.error(row.rowNumber, 'email', BulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Email format is invalid.'));
    }

    if (!row.password) {
      errors.push(this.error(row.rowNumber, 'password', BulkUploadErrorCode.MISSING_REQUIRED_FIELD, 'Password is required.'));
    } else if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(row.password)) {
      errors.push(this.error(row.rowNumber, 'password', BulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Password must include uppercase letter, number and special character.'));
    }

    if (!row.confirmPassword) {
      errors.push(this.error(row.rowNumber, 'confirmPassword', BulkUploadErrorCode.MISSING_REQUIRED_FIELD, 'Confirm password is required.'));
    } else if (row.confirmPassword !== row.password) {
      errors.push(this.error(row.rowNumber, 'confirmPassword', BulkUploadErrorCode.BUSINESS_RULE_VIOLATION, 'Confirm password must match create password.'));
    }

    if (row.userName && (row.userName.length < 3 || row.userName.length > 20)) {
      errors.push(this.error(row.rowNumber, 'userName', BulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Username must be 3 to 20 characters.'));
    }

    if (row.rawStatus && row.status === null) {
      errors.push(this.error(row.rowNumber, 'status', BulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Status must be active or inactive.'));
    }

    if (row.phoneNumber && !/^\+?\d{7,15}$/.test(row.phoneNumber)) {
      errors.push(this.error(row.rowNumber, 'phoneNumber', BulkUploadErrorCode.INVALID_FIELD_FORMAT, 'Phone number format is invalid.'));
    }

    if (row.role === AdminRoles.INSTITUTIONADMIN) {
      if (!row.institutionsId) {
        errors.push(this.error(row.rowNumber, 'institutionsId', BulkUploadErrorCode.MISSING_REQUIRED_FIELD, 'institutionsId is required for INSTITUTION_ADMIN.'));
      }
      if (!row.departmentsId.length) {
        errors.push(this.error(row.rowNumber, 'departmentsId', BulkUploadErrorCode.MISSING_REQUIRED_FIELD, 'departmentsId is required for INSTITUTION_ADMIN.'));
      }
    }

    if (!row.permissionGroupsId.length && !row.permissionGroupName) {
      errors.push(this.error(row.rowNumber, 'permissionGroupName', BulkUploadErrorCode.MISSING_REQUIRED_FIELD, 'Select permission is required.'));
    }

    if (!row.departmentsId.length && !row.departmentName) {
      errors.push(this.error(row.rowNumber, 'departmentName', BulkUploadErrorCode.MISSING_REQUIRED_FIELD, 'Select department is required.'));
    }

    if (row.role && ![AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN].includes(row.role) && row.permissionGroupsId.length === 0 && !row.permissionGroupName) {
      errors.push(this.error(row.rowNumber, 'permissionGroupsId', BulkUploadErrorCode.MISSING_REQUIRED_FIELD, 'permissionGroupsId is required for this role.'));
    }

    return errors;
  }

  private error(rowNumber: number, field: string, code: BulkUploadErrorCode, message: string): AdminUserBulkUploadError {
    return { rowNumber, field, code, message };
  }
}

