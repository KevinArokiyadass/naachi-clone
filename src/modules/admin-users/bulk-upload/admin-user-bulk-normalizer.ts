import { AdminRoles } from '../../../common/enums/user.enum';
import { NormalizedAdminUserUploadRow, ParsedAdminUserUploadRow } from './admin-user-bulk-upload.types';

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

export const normalizeDelimitedStringList = (value: string | number | null | undefined): string[] => {
  const text = toText(value);
  if (!text) {
    return [];
  }
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => Boolean(item));
};

const normalizeRole = (value: string | number | null | undefined): AdminRoles | null => {
  const text = toText(value);
  if (!text) {
    return null;
  }
  const normalized = text.toUpperCase();
  if (normalized === AdminRoles.SUPER_ADMIN) return AdminRoles.SUPER_ADMIN;
  if (normalized === AdminRoles.ADMIN) return AdminRoles.ADMIN;
  if (normalized === AdminRoles.INSTITUTIONADMIN) return AdminRoles.INSTITUTIONADMIN;
  return null;
};

const normalizeStatus = (value: string | number | null | undefined): 'active' | 'inactive' | null => {
  const text = toText(value);
  if (!text) {
    return null;
  }
  const normalized = text.toLowerCase();
  if (normalized === 'active' || normalized === 'inactive') {
    return normalized;
  }
  return null;
};

export const normalizeAdminUserUploadRow = (row: ParsedAdminUserUploadRow): NormalizedAdminUserUploadRow => {
  return {
    rowNumber: row.rowNumber,
    name: toText(row.data.name),
    firstName: toText(row.data.firstName),
    lastName: toText(row.data.lastName),
    email: normalizeEmail(row.data.email),
    userName: toText(row.data.userName),
    password: toText(row.data.password),
    phoneNumber: normalizePhone(row.data.phoneNumber),
    role: normalizeRole(row.data.role),
    status: normalizeStatus(row.data.status),
    rawStatus: toText(row.data.status),
    confirmPassword: toText(row.data.confirmPassword),
    permissionGroupName: toText(row.data.permissionGroupName),
    departmentName: toText(row.data.departmentName),
    permissionGroupsId: normalizeDelimitedStringList(row.data.permissionGroupsId),
    institutionsId: toText(row.data.institutionsId),
    departmentsId: normalizeDelimitedStringList(row.data.departmentsId),
    s3ProfileImageName: toText(row.data.s3ProfileImageName),
  };
};

