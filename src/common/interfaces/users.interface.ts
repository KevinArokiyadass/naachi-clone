export interface IUsers {
    userId: string;
    phoneNumber: string;
    email: string;
    password?: string;
    userName: string;
    Name?: string;
    isActive: boolean;
    isVerified: boolean;
    isDeleted: boolean;
    otp?: string;
    otpExpiry?: Date;
    lastLoginAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
