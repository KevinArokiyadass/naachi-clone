export enum AdminRoles {
  SUPER_ADMIN = 'SUPER_ADMIN',
  INSTITUTIONADMIN="INSTITUTION_ADMIN"
}
export interface IMetaTag {
  institutionsId: string;
  departmentsId: string[];
}

export enum RecordStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
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

export enum accountStatus
{
  PENDING = 'PENDING',
  BLOCKED = 'BLOCKED',
  APPROVED =  'APPROVED',
  LEGITIMATE = 'LEGITIMATE'
}

