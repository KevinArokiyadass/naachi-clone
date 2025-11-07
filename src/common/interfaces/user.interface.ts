import { Document } from 'mongoose';

/**
 * User Type Enum - Classification by role
 */
export enum UserType {
  ADMIN = 'ADMIN',
  CEO = 'CEO',
  MEMBER = 'MEMBER'
}

/**
 * Employment Type Enum - Classification by employment status
 */
export enum EmploymentType {
  PERMANENTFIELD = 'PERMANENTFIELD',
  PERMANENTNONFIELD = 'PERMANENTNONFIELD',
  CONTRACTUAL = 'CONTRACTUAL',
  TEMPORARY = 'TEMPORARY'
}

/**
 * User Status Enum
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED'
}

/**
 * Base User Interface - represents the core user data structure
 */
export interface IUser {
  otp: any;
  otpExpiry: any;
  userId: string;
  phoneNumber?: string;
  emailId?: string;
  password?: string;
  employeeId?: string;
  firstName: string;
  lastName?: string;
  address?: string;
  divisionId?: string;
  locationId?: string;
  userType: UserType;
  profilePictureOriginalFileName?: string;
  profilePictureS3FileName?: string;
  profileImageUrl?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  permissionGroup: string[];
}

/**
 * User Document Interface - extends IUser with MongoDB Document properties and methods
 */
export interface IUserDocument extends IUser, Document {
  // MongoDB Document properties
  _id: any;
  id: string;
  
  // Password helper methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  
  // Mongoose document methods
  save(): Promise<this>;
  remove(): Promise<this>;
  toObject(): IUser;
  toJSON(): IUser;
}

/**
 * User Response Interface - for API responses (excludes sensitive fields)
 */
export interface IUserResponse {
  userId: string;
  otpExpiry: any;
  otp: any;
  phoneNumber?: string;
  emailId?: string;
  employeeId?: string;
  firstName: string;
  lastName?: string;
  address?: string;
  divisionId?: string;
  divisionDetails?: {
    divisionName?: string;
  };
  locationId?: string;
  locationDetails?: {
    locationName?: string;
  };
  userType: UserType;
  profilePictureOriginalFileName?: string;
  profilePictureS3FileName?: string;
  profileImageUrl?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  permissionGroup: string[];
}

/**
 * User Create Interface - for creating new users (Admin only)
 */
export interface IUserCreate {
  phoneNumber?: string;
  emailId: string;
  employeeId?: string;
  firstName: string;
  lastName?: string;
  address?: string;
  divisionId?: string;
  locationId?: string;
  userType: UserType;
  permissionGroup?: string[];
}

/**
 * User Update Interface - for updating existing users
 */
export interface IUserUpdate {
  firstName?: string;
  lastName?: string;
  address?: string;
  divisionId?: string;
  locationId?: string;
  userType?: UserType;
  profilePictureOriginalFileName?: string;
  profilePictureS3FileName?: string;
  profileImageUrl?: string;
  phoneNumber?: string;
  emailId?: string;
  employeeId?: string;
  permissionGroup?: string[];
}
