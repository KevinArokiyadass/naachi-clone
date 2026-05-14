import { NormalizedUserUploadRow, ParsedUserUploadRow } from './user-bulk-upload.types';

const SAFE_TEXT_PREFIXES = ['=', '+', '-', '@'];

const looksLikeSpreadsheetFormula = (text: string): boolean => {
  if (!SAFE_TEXT_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    return false;
  }
  const secondChar = text.charAt(1);
  if ((text.startsWith('+') || text.startsWith('-')) && /\d/.test(secondChar)) {
    return false;
  }
  return true;
};

const toText = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (looksLikeSpreadsheetFormula(text)) {
    return text.slice(1).trim() || null;
  }
  return text;
};

export const normalizeEmail = (value: string | number | null | undefined): string | null => {
  const text = toText(value);
  return text ? text.toLowerCase() : null;
};

export const normalizePhone = (value: string | number | null | undefined): string | null => {
  const text = toText(value);
  if (!text) {
    return null;
  }
  const normalized = text.replace(/[^\d+]/g, '');
  return normalized || null;
};

const normalizeStatus = (
  value: string | number | null | undefined,
): 'active' | 'blocked' | 'pending' | null => {
  const text = toText(value);
  if (!text) {
    return null;
  }
  const normalized = text.toLowerCase();
  if (normalized === 'active' || normalized === 'blocked' || normalized === 'pending') {
    return normalized;
  }
  return null;
};

export const normalizeUserUploadRow = (row: ParsedUserUploadRow): NormalizedUserUploadRow => {
  return {
    rowNumber: row.rowNumber,
    name: toText(row.data.name),
    email: normalizeEmail(row.data.email),
    userName: toText(row.data.userName),
    phoneNumber: normalizePhone(row.data.phoneNumber),
    rawStatus: toText(row.data.status),
    status: normalizeStatus(row.data.status),
    departmentName: toText(row.data.departmentName),
  };
};
