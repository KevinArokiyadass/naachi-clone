export enum AdminRoles {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR'
}

export enum AttributeNames {
  USERS = 'USERS',
  ADMIN_USERS = 'ADMIN_USERS',
  ANALYTICS = 'ANALYTICS',
  SETTINGS = 'SETTINGS',
  REPORTS = 'REPORTS',
  PERMISSIONS = 'PERMISSIONS'
}

export enum AttributeAccess {
  READ = 'READ',
  WRITE = 'WRITE',
  DELETE = 'DELETE',
  ALL = 'ALL'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED'
}