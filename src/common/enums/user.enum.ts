export enum AdminRoles {
  SUPER_ADMIN = 'SUPER_ADMIN',
  INSTITUTIONADMIN="INSTITUTION_ADMIN"
}

export interface IMetaTag {
  institutionsId: string;
  departmentsId: string[];
}