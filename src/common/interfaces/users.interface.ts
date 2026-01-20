import { accountStatus, ReferrerMedium } from "../enums/user.enum";
export interface IUsers {
    userId: string;
    phoneNumber: string;
    email?: string;
    password?: string;
    userName?: string;
    Name?: string;
    isActive: boolean;
    isVerified: boolean;
    isDeleted: boolean;
    otp?: string;
    otpExpiry?: Date;
    lastLoginAt?: Date;
    status: accountStatus;
    phoneVerified: boolean;
    phoneOtp?: string;
    phoneOtpExpiry?: Date;
    userNameSet: boolean;
    emailVerified: boolean;
    emailOtp?: string;
    emailOtpExpiry?: Date;
    expiresAt?: Date;
    referredBy?: string;
    referrerId?: string;
    referrerMedium?: ReferrerMedium;
    institutionsId?: string;
    qrAuth?: boolean;
    profileImage?: string;
    profileImageUpdatedAt?: Date;
    customLogin?: boolean;
    metaData?: {
        institutionId?: string;
    };
    createdAt?: Date;
    updatedAt?: Date;
}
