import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { UserDocument } from '../user/entity/user.entity';
import { IUserDocument, UserType } from 'src/common/interfaces/user.interface';
import { EmailService } from 'src/common/services/email.service';
import { UserService } from '../user/user.service';
import { generateResetToken, hashPassword, comparePassword } from 'src/common/utils/util';

export interface JwtPayload {
    userId: string;
    emailId?: string;
    employeeId?: string;
    phoneNumber?: string;
    userType: UserType;
    iat?: number;
    exp?: number;
}

export interface PasswordResetToken {
    userId: string;
    token: string;
    expiresAt: Date;
}

interface OtpData {
    identifier: string; // Can be email or phone number
    otp: string;
    expiresAt: Date;
    attempts: number;
}

@Injectable()
export class AuthService {
    private resetTokens: Map<string, PasswordResetToken> = new Map();
    private otpStore: Map<string, OtpData> = new Map();
    private readonly DEFAULT_OTP = '1234';
    private readonly OTP_EXPIRY_MINUTES = 5;
    private readonly MAX_OTP_ATTEMPTS = 3;

    constructor(
        private jwtService: JwtService,
        private dbService: IMongoDBServices,
        private emailService: EmailService,
        private userService: UserService,
    ) { }

    // Helper method to detect if identifier is email or phone number
    private isEmail(identifier: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(identifier);
    }

    // Admin Login - with email/username and password
    async adminLogin(identifier: string, password: string, fcmToken: string): Promise<{
        user: UserDocument;
        accessToken: string;
        message: string;
    }> {
        // Find admin user by email or username
        const user = await this.dbService.user.findOne({
            $and: [
                { userType: UserType.ADMIN },
                {
                    $or: [
                        { emailId: identifier },
                        { employeeId: identifier }
                    ]
                }
            ]
        }) as UserDocument;

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is inactive. Please contact administrator.');
        }

        if (!user.password) {
            throw new UnauthorizedException('Account is not properly configured. Please contact administrator.');
        }

        // Compare password
        const isPasswordValid = password === user.password
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Update last login
        await this.dbService.user.findOneAndUpdate(
            { userId: user.userId },
            { lastLoginAt: new Date() }
        );

        // Generate JWT token
        const payload: JwtPayload = {
            userId: user.userId,
            emailId: user.emailId,
            employeeId: user.employeeId,
            phoneNumber: user.phoneNumber,
            userType: user.userType,
        };

        const accessToken = this.jwtService.sign(payload);
        if (fcmToken) {
            await this.userService.updateUserFcmToken(user.userId, { type: 'web', token: fcmToken });
        }
        // Populate location and division names
        const populatedUser = await this.userService.populateUserMasterData(user);


        return {
            user: populatedUser,
            accessToken,
            message: 'Admin login successful',
        };
    }

    // Member Login - trigger OTP to email or phone
    async memberLogin(identifier: string): Promise<{ message: string; expiresAt: Date }> {
        // Find member user by email or phone number
        let user: UserDocument;
        
        if (this.isEmail(identifier)) {
            user = await this.dbService.user.findOne({ 
                emailId: identifier,
            
            }) as UserDocument;
        }
        if (!user) {
            throw new UnauthorizedException('Email not registered');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is inactive. Please contact administrator.');
        }

        await this.userService.sendOtp(identifier);

        return {
            message: 'OTP sent to your email/phone number',
            expiresAt: user.otpExpiry,
        };
    }

    // Member OTP Verification
    async memberOtpVerify(identifier: string, otp: string, fcmToken: string): Promise<{
        user: UserDocument;
        accessToken: string;
        message: string;
    }> {
        const isOtpValid = await this.userService.verifyOtp(identifier, otp);
        if (!isOtpValid) {
            throw new UnauthorizedException('Invalid OTP');
        }
        let user: UserDocument;
        
        if (this.isEmail(identifier)) {
            user = await this.dbService.user.findOne({
                emailId: identifier
            }) as UserDocument;
        } 

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Update FCM token if provided
        if (fcmToken) {
            await this.userService.updateUserFcmToken(user.userId, { type: 'mobile', token: fcmToken });
        }

        // Update last login
        await this.dbService.user.findOneAndUpdate(
            { userId: user.userId },
            { lastLoginAt: new Date() }
        );

        // Populate location and division names
        const populatedUser = await this.userService.populateUserMasterData(user);

        // Generate JWT token
        const payload: JwtPayload = {
            userId: user.userId,
            emailId: user.emailId,
            employeeId: user.employeeId,
            phoneNumber: user.phoneNumber,
            userType: user.userType,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            user: populatedUser,
            accessToken,
            message: 'Member login successful',
        };
    }

    async login(emailId: string, password: string): Promise<{
        user: UserDocument;
        accessToken: string;
        message: string;
    }> {
        const user = await this.dbService.user.findOne({ emailId }) as UserDocument;

        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is inactive. Please contact administrator.');
        }

        // Compare password
        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // Update last login
        await this.dbService.user.findOneAndUpdate(
            { emailId },
            { lastLoginAt: new Date() }
        );

        // Generate JWT token
        const payload: JwtPayload = {
            userId: user.userId,
            emailId: user.emailId,
            employeeId: user.employeeId,
            phoneNumber: user.phoneNumber,
            userType: user.userType,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            user,
            accessToken,
            message: 'Login successful',
        };
    }

    async forgotPassword(emailId: string): Promise<{ message: string }> {
        const user = await this.dbService.user.findOne({ emailId }) as UserDocument;

        if (!user) {
            // Don't reveal if email exists or not for security
            return { message: 'If the email exists, a password reset link has been sent.' };
        }

        if (!user.isActive) {
            throw new BadRequestException('Account is inactive. Please contact administrator.');
        }

        // Generate reset token
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        // Store reset token (in production, store this in database)
        this.resetTokens.set(resetToken, {
            userId: user.userId,
            token: resetToken,
            expiresAt,
        });

        // Send reset email
        await this.emailService.sendPasswordResetEmail(user.emailId, user.firstName, resetToken);

        return { message: 'If the email exists, a password reset link has been sent.' };
    }

    async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
        const resetTokenData = this.resetTokens.get(token);

        if (!resetTokenData || resetTokenData.expiresAt < new Date()) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        const user = await this.dbService.user.findOne({ userId: resetTokenData.userId }) as UserDocument;

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update user password
        await this.dbService.user.findOneAndUpdate(
            { userId: user.userId },
            { password: hashedPassword }
        );

        // Remove used token
        this.resetTokens.delete(token);

        return { message: 'Password has been reset successfully' };
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
        const user = await this.dbService.user.findOne({ userId }) as UserDocument;

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update user password
        await this.dbService.user.findOneAndUpdate(
            { userId },
            { password: hashedPassword }
        );

        return { message: 'Password has been changed successfully' };
    }

    async validateUser(payload: JwtPayload): Promise<UserDocument | null> {
        const user = await this.dbService.user.findOne({ userId: payload.userId }) as UserDocument | null;
        return user;
    }

    async getUserFromToken(token: string): Promise<UserDocument | null> {
        try {
            const payload = this.jwtService.verify(token) as JwtPayload;
            return await this.validateUser(payload);
        } catch (error) {
            return null;
        }
    }

    generateToken(user: UserDocument): string {
        const payload: JwtPayload = {
            userId: user.userId,
            emailId: user.emailId,
            employeeId: user.employeeId,
            phoneNumber: user.phoneNumber,
            userType: user.userType,
        };
        return this.jwtService.sign(payload);
    }
}
