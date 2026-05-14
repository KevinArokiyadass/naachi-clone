import type { BulkUploadOutcome } from '../../../common/utils/bulk-upload-outcome.util';

export enum UserBulkUploadErrorCode {
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_FORMAT = 'INVALID_FIELD_FORMAT',
  DUPLICATE_IN_FILE = 'DUPLICATE_IN_FILE',
  DUPLICATE_IN_DB = 'DUPLICATE_IN_DB',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INTERNAL_PROCESSING_ERROR = 'INTERNAL_PROCESSING_ERROR',
}

export interface UserBulkUploadError {
  rowNumber: number;
  field: string;
  code: UserBulkUploadErrorCode;
  message: string;
}

export interface ParsedUserUploadRow {
  rowNumber: number;
  data: Record<string, string | null | number>;
}

export interface NormalizedUserUploadRow {
  rowNumber: number;
  name: string | null;
  email: string | null;
  userName: string | null;
  phoneNumber: string | null;
  /** Canonical status when valid; null when omitted or invalid. */
  status: 'active' | 'blocked' | 'pending' | null;
  /** Original cell text for status (after trim); used to detect invalid values vs omitted. */
  rawStatus: string | null;
  departmentName: string | null;
  departmentsId?: string;
}

export interface UserBulkUploadResult {
  totalRows: number;
  processedRows: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  errors: UserBulkUploadError[];
  createdIds: string[];
  updatedIds: string[];
  dryRun: boolean;
  /** Present on responses from processUpload; use with failureCount / successCount for UI messaging. */
  uploadOutcome?: BulkUploadOutcome;
  reportFileName?: string;
  reportCsvBase64?: string;
  rejectedExcelFileName?: string;
  rejectedExcelBase64?: string;
}

export interface ExistingUserLookupMaps {
  byEmail: Map<string, { userId: string; email: string }>;
  byUserName: Map<string, { userId: string; userName: string }>;
  byPhoneNumber: Map<string, { userId: string; phoneNumber: string }>;
}
