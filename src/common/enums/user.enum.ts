export enum AdminRoles {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  INSTITUTIONADMIN = 'INSTITUTION_ADMIN',
}
export interface IMetaTag {
  institutionsId: string;
  departmentsId: string[];
}

export enum RecordStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export enum RecordUserRole {
  STUDENT = 'STUDENT',
  EXTERNAL = 'EXTERNAL',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
  GUEST = 'GUEST',
}

export enum ReportType{
  SPAM = 'SPAM',
  SCAM = 'SCAM',
  FAKE_ACCOUNT = 'FAKE_ACCOUNT',
  HARASSMENT = 'HARASSMENT',
  PORN = 'PORN',
  FRAUD = 'FRAUD',
  ABUSE = 'ABUSE',
  RACISM = 'RACISM',
  OTHER = 'OTHER',
}

export const USER_STATUS = {
  PENDING: 'pending',
  BLOCKED: 'blocked',
  ACTIVE: 'active',
  INACTIVE:'inactive'
} as const;

export const userStatus = [
  USER_STATUS.PENDING,
  USER_STATUS.BLOCKED,
  USER_STATUS.ACTIVE,
] as const;

export type UserStatus = (typeof userStatus)[number];

// Helper to normalize legacy/other statuses to the new canonical ones
// - 'completed', 'approved', 'legitimate', 'active' -> 'active'
// - 'pending' -> 'pending'
// - 'blocked' -> 'blocked'
// - any unknown status -> 'pending' (safe default)
export function mapToUserStatus(status: string): UserStatus {
  const normalized = status?.toLowerCase?.();

  const legacyToUserStatusMap: Record<string, UserStatus> = {
    pending: USER_STATUS.PENDING,
    blocked: USER_STATUS.BLOCKED,
    active: USER_STATUS.ACTIVE,
    completed: USER_STATUS.ACTIVE,
    approved: USER_STATUS.ACTIVE,
    legitimate: USER_STATUS.ACTIVE,
  };

  return legacyToUserStatusMap[normalized] ?? USER_STATUS.PENDING;
}

export enum ReferrerMedium {
  QR_CODE = 'qrCode',
  INSTITUTION_MAIL = 'institutionMail',
  MUTUAL_FRIEND = 'mutualFriend',
  REFERRAL_CODE = 'referralCode',
  BULK_UPLOAD_INSTITUTION = 'bulkuploadInstitution'
}