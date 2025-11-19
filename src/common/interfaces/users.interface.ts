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
    status: string;
    phoneVerified: boolean;
    phoneOtp?: string;
    phoneOtpExpiry?: Date;
    userNameSet: boolean;
    emailVerified: boolean;
    emailOtp?: string;
    emailOtpExpiry?: Date;
    expiresAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
