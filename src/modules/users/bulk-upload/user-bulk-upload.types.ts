import type { BulkUploadOutcome } from '../../../common/utils/bulk-upload-outcome.util';

export enum UserBulkUploadErrorCode {
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_FORMAT = 'INVALID_FIELD_FORMAT',
  DUPLICATE_IN_FILE = 'DUPLICATE_IN_FILE',
  DUPLICATE_IN_DB = 'DUPLICATE_IN_DB',
  ALREADY_LINKED_NO_CHANGE = 'ALREADY_LINKED_NO_CHANGE',
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
  /** Rows rejected because the user is already linked to this institution and no fields would change. */
  rejectedCount: number;
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

export interface ExistingUserRecord {
  userId: string;
  email?: string;
  phoneNumber?: string;
  userName?: string;
  institutionsId?: string;
}

export interface ExistingUserLookupMaps {
  byEmail: Map<string, ExistingUserRecord>;
  byUserName: Map<string, ExistingUserRecord>;
  byPhoneNumber: Map<string, ExistingUserRecord>;
}
