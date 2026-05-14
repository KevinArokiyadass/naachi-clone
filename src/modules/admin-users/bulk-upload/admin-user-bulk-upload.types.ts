import type { BulkUploadOutcome } from '../../../common/utils/bulk-upload-outcome.util';
import { AdminRoles } from '../../../common/enums/user.enum';

export enum BulkUploadErrorCode {
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_FORMAT = 'INVALID_FIELD_FORMAT',
  DUPLICATE_IN_FILE = 'DUPLICATE_IN_FILE',
  DUPLICATE_IN_DB = 'DUPLICATE_IN_DB',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INTERNAL_PROCESSING_ERROR = 'INTERNAL_PROCESSING_ERROR',
}

export interface AdminUserBulkUploadError {
  rowNumber: number;
  field: string;
  code: BulkUploadErrorCode;
  message: string;
}

export interface ParsedAdminUserUploadRow {
  rowNumber: number;
  data: Record<string, string | null | number>;
}

export interface NormalizedAdminUserUploadRow {
  rowNumber: number;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  userName: string | null;
  password: string | null;
  phoneNumber: string | null;
  role: AdminRoles | null;
  status: 'active' | 'inactive' | null;
  rawStatus: string | null;
  confirmPassword: string | null;
  permissionGroupName: string | null;
  departmentName: string | null;
  permissionGroupsId: string[];
  institutionsId: string | null;
  departmentsId: string[];
  s3ProfileImageName: string | null;
}

export interface AdminUserBulkUploadResult {
  totalRows: number;
  processedRows: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  errors: AdminUserBulkUploadError[];
  createdIds: string[];
  updatedIds: string[];
  dryRun: boolean;
  /** Present on responses from processUpload; use with failureCount / successCount for UI messaging. */
  uploadOutcome?: BulkUploadOutcome;
  rejectedExcelFileName?: string;
  rejectedExcelBase64?: string;
}

export interface ExistingAdminLookupMaps {
  byEmail: Map<string, { adminId: string; email: string }>;
  byUserName: Map<string, { adminId: string; userName: string }>;
  byPhoneNumber: Map<string, { adminId: string; phoneNumber: string }>;
}

