import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { SignupTemp, SignupTempDocument } from './entity/signup-temp.entity';
import { UsersDocument } from './entity/users.entity';
import { EmailService } from 'src/common/services/email.service';
import { CommonAuthService } from 'src/common/services/auth.service';



@Injectable()
export class UsersService {
    private readonly OTP_EXPIRY_MINUTES = 5;
    private readonly TEMP_DATA_EXPIRY_MINUTES = 30;

    constructor(
        private readonly dbService: IMongoDBServices,
        private readonly emailService: EmailService,
        private readonly commonAuthService: CommonAuthService
    ) {}

    
    private generateOtp(): string {
        return Math.floor(1000 + Math.random() * 90000).toString();
    }

    async verifyPhone(phoneNumber: string): Promise<{
        message: string;
        expiresAt: Date;
    }> {
        const existingUser = await this.dbService.users.findOne({
            phoneNumber,
            isDeleted: false
        }) as UsersDocument | null;

        if (existingUser) {
            throw new BadRequestException('Phone number already registered');
        }

        const otp = this.generateOtp();
        const otpExpiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
        const dataExpiry = new Date(Date.now() + this.TEMP_DATA_EXPIRY_MINUTES * 60 * 1000);
        
        await this.dbService.signupTemp.findOneAndUpdate(
            { phoneNumber },
            {
                phoneNumber,
                phoneOtp: otp,
                phoneOtpExpiry: otpExpiry,
                phoneVerified: false,
                userNameSet: false,
                emailVerified: false,
                completed: false,
                expiresAt: dataExpiry
            },
            { upsert: true, new: true }
        );

        console.log(`Phone OTP for ${phoneNumber}: ${otp}`);

        return {
            message: 'OTP sent to your phone number',
            expiresAt: otpExpiry
        };
    }

    async confirmPhone(phoneNumber: string, otp: string): Promise<{
        message: string;
    }> {
        const tempData = await this.getTempSignupData(phoneNumber);

        if (tempData.phoneVerified) {
            return {
                message: 'Phone already verified'
            };
        }

        if (!tempData.phoneOtp || !tempData.phoneOtpExpiry) {
            throw new BadRequestException('No OTP found. Please request a new OTP.');
        }

        if (tempData.phoneOtpExpiry < new Date()) {
            throw new UnauthorizedException('OTP expired. Please request a new OTP.');
        }

        if (tempData.phoneOtp !== otp) {
            throw new UnauthorizedException('Invalid OTP');
        }

        await this.dbService.signupTemp.findOneAndUpdate(
            { phoneNumber },
            {
                phoneVerified: true,
                phoneOtp: null,
                phoneOtpExpiry: null
            }
        );

        return {
            message: 'Phone verified successfully'
        };
    }

    async setUsername(phoneNumber: string, userName: string): Promise<{
        message: string;
    }> {
        const tempData = await this.getTempSignupData(phoneNumber);

        if (!tempData.phoneVerified) {
            throw new BadRequestException('Phone number must be verified first');
        }

        const existingUser = await this.dbService.users.findOne({
            userName,
            isDeleted: false
        }) as UsersDocument | null;

        if (existingUser) {
            throw new BadRequestException('Username already taken');
        }

        // Update temp data with username
        await this.dbService.signupTemp.findOneAndUpdate(
            { phoneNumber },
            {
                userName,
                userNameSet: true
            }
        );

        return {
            message: 'Username set successfully'
        };
    }

    async verifyEmail(phoneNumber: string, email: string): Promise<{
        message: string;
        expiresAt: Date;
    }> {
        const tempData = await this.getTempSignupData(phoneNumber);

        if (!tempData.phoneVerified) {
            throw new BadRequestException('Phone number must be verified first');
        }

        if (!tempData.userNameSet || !tempData.userName) {
            throw new BadRequestException('Username must be set first');
        }

        // Check if email already registered
        const existingUser = await this.dbService.users.findOne({
            email,
            isDeleted: false
        }) as UsersDocument | null;

        if (existingUser) {
            throw new BadRequestException('Email already registered');
        }

        // Generate and send OTP
        const otp = this.generateOtp();
        const otpExpiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        // Update temp data with email and OTP
        await this.dbService.signupTemp.findOneAndUpdate(
            { phoneNumber },
            {
                email,
                emailOtp: otp,
                emailOtpExpiry: otpExpiry,
                emailVerified: false
            }
        );

        // Send OTP to email
        try {
            await this.emailService.sendOtp(email, otp);
            console.log(`Email OTP sent to: ${email}`);
        } catch (error) {
            console.error(`Failed to send email OTP: ${error.message}`);
        }

        return {
            message: 'OTP sent to your email',
            expiresAt: otpExpiry
        };
    }

    async confirmEmail(email: string, otp: string): Promise<{
        message: string;
    }> {
        // Find temp data by email
        const tempData = await this.dbService.signupTemp.findOne({ email }) as SignupTempDocument | null;
        
        if (!tempData) {
            throw new NotFoundException('Email verification session not found');
        }

        // Validate: Previous steps must be completed
        if (!tempData.phoneVerified) {
            throw new BadRequestException('Phone number must be verified first');
        }

        if (!tempData.userNameSet) {
            throw new BadRequestException('Username must be set first');
        }

        // Check if already verified
        if (tempData.emailVerified) {
            return {
                message: 'Email already verified'
            };
        }

        // Verify OTP
        if (!tempData.emailOtp || !tempData.emailOtpExpiry) {
            throw new BadRequestException('No OTP found. Please request a new OTP.');
        }

        if (tempData.emailOtpExpiry < new Date()) {
            throw new UnauthorizedException('OTP expired. Please request a new OTP.');
        }

        if (tempData.emailOtp !== otp) {
            throw new UnauthorizedException('Invalid OTP');
        }

        // Mark email as verified
        await this.dbService.signupTemp.findOneAndUpdate(
            { phoneNumber: tempData.phoneNumber },
            {
                emailVerified: true,
                emailOtp: null,
                emailOtpExpiry: null
            }
        );

        return {
            message: 'Email verified successfully'
        };
    }

    async completeSignup(phoneNumber: string, Name?: string): Promise<{
        user: UsersDocument;
        accessToken: string;
        message: string;
    }> {
        const tempData = await this.getTempSignupData(phoneNumber);


        if (!tempData.phoneVerified) {
            throw new BadRequestException('Phone number must be verified');
        }

        if (!tempData.userNameSet || !tempData.userName) {
            throw new BadRequestException('Username must be set');
        }

        if (!tempData.emailVerified || !tempData.email) {
            throw new BadRequestException('Email must be verified');
        }

        if (tempData.completed) {
            throw new BadRequestException('Signup already completed');
        }

        // Create user
        const newUser = await this.dbService.users.create({
            phoneNumber: tempData.phoneNumber,
            email: tempData.email,
            userName: tempData.userName,
            Name: Name || tempData.Name,
            isActive: true,
            isVerified: true,
            isDeleted: false,
            lastLoginAt: new Date()
        }) as UsersDocument;

        
        await this.dbService.signupTemp.findOneAndUpdate(
            { phoneNumber },
            {
                completed: true,
                completedAt: new Date()
            }
        );

        const accessToken = this.commonAuthService.generateUsersToken(newUser);
        
        return {
            user: newUser,
            accessToken,
            message: 'Signup completed successfully!'
        };
    }

    private async getTempSignupData(phoneNumber: string): Promise<SignupTempDocument> {
        const tempData = await this.dbService.signupTemp.findOne({
            phoneNumber,
            completed: false
        }) as SignupTempDocument | null;

        if (!tempData) {
            throw new NotFoundException('Signup session not found or expired');
        }

        if (tempData.expiresAt < new Date()) {
            throw new UnauthorizedException('Signup session expired. Please start again.');
        }

        return tempData;
    }

    async getSignupStatus(phoneNumber: string): Promise<{
        phoneNumber: string;
        phoneVerified: boolean;
        userNameSet: boolean;
        emailVerified: boolean;
        completed: boolean;
        expiresAt: Date;
    }> {
        const signUpdata = await this.getTempSignupData(phoneNumber);
        
        return {
            phoneNumber: signUpdata.phoneNumber,
            phoneVerified: signUpdata.phoneVerified,
            userNameSet: signUpdata.userNameSet,
            emailVerified: signUpdata.emailVerified,
            completed: signUpdata.completed,
            expiresAt: signUpdata.expiresAt
        };
    }
}
