export type BulkUploadOutcome = 'success' | 'partial_failure' | 'failed';

export function assignBulkUploadOutcome<
  T extends { successCount: number; failureCount: number; errors: unknown[]; totalRows: number },
>(result: T): T & { uploadOutcome: BulkUploadOutcome } {
  let uploadOutcome: BulkUploadOutcome;
  if (result.failureCount === 0) {
    uploadOutcome = 'success';
  } else if (result.successCount === 0) {
    uploadOutcome = 'failed';
  } else {
    uploadOutcome = 'partial_failure';
  }
  return Object.assign(result, { uploadOutcome });
}

export function isBulkUploadSummaryPayload(value: unknown): value is {
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: unknown[];
} {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.totalRows === 'number' &&
    typeof v.successCount === 'number' &&
    typeof v.failureCount === 'number' &&
    Array.isArray(v.errors)
  );
}
