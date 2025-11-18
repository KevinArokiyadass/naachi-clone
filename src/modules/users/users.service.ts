import { Injectable, BadRequestException, UnauthorizedException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { UsersDocument } from './entity/users.entity';
import { EmailService } from 'src/common/services/email.service';
import { CommonAuthService } from 'src/common/services/auth.service';



@Injectable()
export class UsersService {
    private readonly OTP_EXPIRY_MINUTES = 5;
    private readonly TEMP_DATA_EXPIRY_MINUTES = 30;
    private readonly DEFAULT_PHONE_OTP = '64321';

    constructor(
        private readonly dbService: IMongoDBServices,
        private readonly emailService: EmailService,
        private readonly commonAuthService: CommonAuthService
    ) {}

    
    private generateOtp(): string {
        return Math.floor(1000 + Math.random() * 90000).toString();
    }

    // Use a fixed OTP for phone number verification as requested
    private generatePhoneOtp(): string {
        return this.DEFAULT_PHONE_OTP;
    }

    async verifyPhone(phoneNumber: string): Promise<{
        message: string;
        expiresAt: Date;
    }> {
        const existingUser = await this.dbService.users.findOne({
            phoneNumber,
            isDeleted: false,
            status: 'completed'
        }) as UsersDocument | null;

        if (existingUser) {
            throw new BadRequestException('Phone number already registered');
        }

        // Check if there's a pending signup
        const pendingUser = await this.dbService.users.findOne({
            phoneNumber,
            isDeleted: false,
            status: 'pending'
        }) as UsersDocument | null;

        const otp = this.generatePhoneOtp();
        const otpExpiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
        const dataExpiry = new Date(Date.now() + this.TEMP_DATA_EXPIRY_MINUTES * 60 * 1000);
        
        if (pendingUser) {
            // Update existing pending signup
            await this.dbService.users.findOneAndUpdate(
                { phoneNumber, status: 'pending' },
                {
                    phoneOtp: otp,
                    phoneOtpExpiry: otpExpiry,
                    phoneVerified: false,
                    userNameSet: false,
                    emailVerified: false,
                    expiresAt: dataExpiry
                }
            );
        } else {
            // Create new pending signup
            await this.dbService.users.create({
                phoneNumber,
                phoneOtp: otp,
                phoneOtpExpiry: otpExpiry,
                phoneVerified: false,
                userNameSet: false,
                emailVerified: false,
                status: 'pending',
                isActive: false,
                isVerified: false,
                isDeleted: false,
                expiresAt: dataExpiry
            });
        }

        console.log(`Phone OTP for ${phoneNumber}: ${otp}`);

        return {
            message: 'OTP sent to your phone number',
            expiresAt: otpExpiry
        };
    }

    async confirmPhone(phoneNumber: string, otp: string): Promise<{
        message: string;
    }> {
        const userData = await this.getSignupData(phoneNumber);

        if (userData.phoneVerified) {
            return {
                message: 'Phone already verified'
            };
        }

        if (!userData.phoneOtp || !userData.phoneOtpExpiry) {
            throw new BadRequestException('No OTP found. Please request a new OTP.');
        }

        if (userData.phoneOtpExpiry < new Date()) {
            throw new UnauthorizedException('OTP expired. Please request a new OTP.');
        }

        if (userData.phoneOtp !== otp) {
            throw new UnauthorizedException('Invalid OTP');
        }

        await this.dbService.users.findOneAndUpdate(
            { phoneNumber, status: 'pending' },
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
        const userData = await this.getSignupData(phoneNumber);

        if (!userData.phoneVerified) {
            throw new BadRequestException('Phone number must be verified first');
        }

        const existingUser = await this.dbService.users.findOne({
            userName,
            isDeleted: false
        }) as UsersDocument | null;

        if (existingUser) {
            throw new BadRequestException('Username already taken');
        }

        // Update user data with username
        await this.dbService.users.findOneAndUpdate(
            { phoneNumber, status: 'pending' },
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
        const userData = await this.getSignupData(phoneNumber);

        if (!userData.phoneVerified) {
            throw new BadRequestException('Phone number must be verified first');
        }

        if (!userData.userNameSet || !userData.userName) {
            throw new BadRequestException('Username must be set first');
        }

        // Check if email already registered
        const existingUser = await this.dbService.users.findOne({
            email,
            isDeleted: false,
            status: 'completed'
        }) as UsersDocument | null;

        if (existingUser) {
            throw new BadRequestException('Email already registered');
        }

        // Generate and send OTP
        const otp = this.generateOtp();
        const otpExpiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        // Update user data with email and OTP
        await this.dbService.users.findOneAndUpdate(
            { phoneNumber, status: 'pending' },
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
        // Find user data by email
        const userData = await this.dbService.users.findOne({ 
            email, 
            status: 'pending' 
        }) as UsersDocument | null;
        
        if (!userData) {
            throw new NotFoundException('Email verification session not found');
        }

        // Validate: Previous steps must be completed
        if (!userData.phoneVerified) {
            throw new BadRequestException('Phone number must be verified first');
        }

        if (!userData.userNameSet) {
            throw new BadRequestException('Username must be set first');
        }

        // Check if already verified
        if (userData.emailVerified) {
            return {
                message: 'Email already verified'
            };
        }

        // Verify OTP
        if (!userData.emailOtp || !userData.emailOtpExpiry) {
            throw new BadRequestException('No OTP found. Please request a new OTP.');
        }

        if (userData.emailOtpExpiry < new Date()) {
            throw new UnauthorizedException('OTP expired. Please request a new OTP.');
        }

        if (userData.emailOtp !== otp) {
            throw new UnauthorizedException('Invalid OTP');
        }

        // Mark email as verified and update status to completed
        await this.dbService.users.findOneAndUpdate(
            { email, status: 'pending' },
            {
                emailVerified: true,
                emailOtp: null,
                emailOtpExpiry: null,
                status: 'completed',
                isActive: true,
                isVerified: true
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
        // Find user by phoneNumber - could be pending or completed (after email confirmation)
        const userData = await this.dbService.users.findOne({
            phoneNumber,
            isDeleted: false,
            status: { $in: ['pending', 'completed'] }
        }) as UsersDocument | null;

        if (!userData) {
            throw new NotFoundException('Signup session not found');
        }

        if (!userData.phoneVerified) {
            throw new BadRequestException('Phone number must be verified');
        }

        if (!userData.userNameSet || !userData.userName) {
            throw new BadRequestException('Username must be set');
        }

        if (!userData.emailVerified || !userData.email) {
            throw new BadRequestException('Email must be verified');
        }

        // Update user with final details and ensure status is completed
        const updatedUser = await this.dbService.users.findOneAndUpdate(
            { phoneNumber, status: { $in: ['pending', 'completed'] } },
            {
                Name: Name || userData.Name,
                status: 'completed',
                isActive: true,
                isVerified: true,
                lastLoginAt: new Date(),
                // Clean up temporary fields
                phoneOtp: null,
                phoneOtpExpiry: null,
                emailOtp: null,
                emailOtpExpiry: null,
                expiresAt: null
            },
            { new: true }
        ) as UsersDocument;

        if (!updatedUser) {
            throw new NotFoundException('User not found');
        }

        const accessToken = this.commonAuthService.generateUsersToken(updatedUser);
        
        return {
            user: updatedUser,
            accessToken,
            message: 'Signup completed successfully!'
        };
    }

    private async getSignupData(phoneNumber: string): Promise<UsersDocument> {
        const userData = await this.dbService.users.findOne({
            phoneNumber,
            status: 'pending',
            isDeleted: false
        }) as UsersDocument | null;

        if (!userData) {
            throw new NotFoundException('Signup session not found or expired');
        }

        if (userData.expiresAt && userData.expiresAt < new Date()) {
            throw new UnauthorizedException('Signup session expired. Please start again.');
        }

        return userData;
    }

    async getSignupStatus(phoneNumber: string): Promise<{
        phoneNumber: string;
        phoneVerified: boolean;
        userNameSet: boolean;
        emailVerified: boolean;
        status: string;
        expiresAt?: Date;
    }> {
        const userData = await this.getSignupData(phoneNumber);
        
        return {
            phoneNumber: userData.phoneNumber,
            phoneVerified: userData.phoneVerified,
            userNameSet: userData.userNameSet,
            emailVerified: userData.emailVerified,
            status: userData.status,
            expiresAt: userData.expiresAt
        };
    }
}



// import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
// import {
//   CognitoIdentityProviderClient,
//   SignUpCommand,
//   InitiateAuthCommand,
//   GetUserCommand,
//   GlobalSignOutCommand,
//   ResendConfirmationCodeCommand,
//   RevokeTokenCommand,
//   AuthFlowType,
//   RespondToAuthChallengeCommand,
//   SignUpCommandInput,
//   AdminDeleteUserCommand
// } from '@aws-sdk/client-cognito-identity-provider';
// import { ErrorException } from '../../common/errors/custom-error.exception';
// import { RefreshTokenDto, VerifyOtpDto } from './dto/auth.dto';
// import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
// import { IUser } from '../../common/interfaces/user.interface';
// import { nanoid } from 'nanoid';
// import { Helpers } from '../../common/helpers/common.helpers';
// import { ActionLogService } from '../../common/shared/action-log/actionLog.service';
// import { CollectionNames } from '../../common/constants/service-common.constants';
// import { UserCodesService } from '../user-codes/user-codes.service';
// import { HttpClientService } from '../../common/inter-service-communication/http-client.service';
// import { JwtService } from '@nestjs/jwt';
// import { UserTypeEnum } from '../../common/enums/user.enum';

// @Injectable()
// export class AuthService {
//   private cognitoClient: CognitoIdentityProviderClient;

//   constructor(
//     private dbService: IMongoDBServices,
//     private actionLogService: ActionLogService,
//     private userCodeService: UserCodesService,
//     private httpClientService: HttpClientService,
//     private readonly jwtService: JwtService
//   ) {
//     this.cognitoClient = new CognitoIdentityProviderClient({
//       region: process.env.AWS_REGION,
//       credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//       },
//     });
//   }

//   // Create a user in Cognito with phone number as username
//   async createUser(phoneNumber: string, name: string, businessName: string, emailId: string, gstNumber: string, industryType: string, serviceableArea: string) {
//     try {
//       const userDetail = await this.dbService.user.findOne({ phoneNumber });
//       if (userDetail) {
//         throw new BadRequestException({ message: 'User already Exists', errorCode: "USER_ALREADY_EXIST" });
//       } else {
//         const userLead = await this.dbService.lead.findOne({ phoneNumber });
//         const userDetail: IUser = {
//           userId: userLead?.userLeadId || nanoid(),
//           name,
//           phoneNumber,
//           businessName,
//           industryType,
//           serviceableArea,
//           emailId,
//           gstNumber,
//           referralCode: Helpers.generateReferralCode(),
//           subscriptionStatus: undefined,
//           userCode: await this.userCodeService.generateUserCode()
//         }
//         await this.signUpUserInCognito(phoneNumber, name, userDetail.userId)
//         const initResponse = await this.generateOtp(phoneNumber)
//         if (serviceableArea) {
//           const zones: any = await this.httpClientService.get('CONFIG_SERVICE', '/zones', {}) as any;
//           const zoneId = zones.find((zone: any) => zone.zoneName === serviceableArea)?.zoneId ?? null;
//           userDetail.zoneId = zoneId;
//         }
//         const createdUser = await this.dbService.user.create(userDetail);
//         if (createdUser && userLead) {
//           await this.dbService.lead.findOneAndUpdate({ userLeadId: userLead.userLeadId }, { $set: { isDeleted: true } });
//           await this.actionLogService.logDeleteAction(CollectionNames.USERLEAD, userLead, userLead.userLeadId);
//         }
//         return {
//           message: 'OTP sent successfully',
//           user: userDetail,
//           challengeName: initResponse.ChallengeName,
//           session: initResponse.Session,
//         };
//       }
//     } catch (error) {
//       console.log(error)
//       if (error instanceof BadRequestException) {
//         const { message = "", errorCode = "" } = error.getResponse() as Record<string, any>;
//         throw new BadRequestException({ message, errorCode });
//       }
//       throw new ErrorException('Failed to create user in Cognito');
//     }
//   }

//   async signUpUserInCognito(phoneNumber: string, name: string, userId: string): Promise<void> {
//     const signUpUserParams: SignUpCommandInput = {
//       Username: phoneNumber,
//       UserAttributes: [
//         { Name: 'phone_number', Value: phoneNumber },
//         { Name: 'name', Value: name },
//         { Name: 'custom:userId', Value: userId }
//       ],
//       ValidationData: null,
//       Password: Helpers.generateTempPassword(),
//       ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID
//     }
//     const signUpUserCommand = new SignUpCommand(signUpUserParams);
//     await this.cognitoClient.send(signUpUserCommand);
//   }

//   async signInUser(phoneNumber: string) {
//     const userDetail = await this.dbService.user.findOne({ phoneNumber });
//     if (userDetail) {
//       const initResponse = await this.generateOtp(phoneNumber)
//       return {
//         message: 'OTP sent successfully',
//         user: userDetail,
//         challengeName: initResponse.ChallengeName,
//         session: initResponse.Session,
//       };
//     } else {
//       throw new BadRequestException('User does not exist');
//     }
//   }

//   async generateOtp(phoneNumber: string) {
//     try {
//       const initParams = {
//         AuthFlow: AuthFlowType.CUSTOM_AUTH,
//         AuthParameters: {
//           USERNAME: phoneNumber
//         },
//         ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID
//       };
//       const initAuthUserCommand = new InitiateAuthCommand(initParams);
//       const initResponse = await this.cognitoClient.send(initAuthUserCommand);
//       return initResponse
//     } catch (err) {
//       console.log(err);
//       throw new ErrorException('Failed to generate OTP');
//     }
//   }

//   // Verify OTP (Optimized for persistent OTP retry mechanism)
//   async verifyOTP(verifyOtpDto: VerifyOtpDto) {
//     const { phoneNumber, code, session } = verifyOtpDto;
//     try {
//       const command = new RespondToAuthChallengeCommand({
//         ChallengeName: 'CUSTOM_CHALLENGE',
//         ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
//         ChallengeResponses: {
//           USERNAME: phoneNumber,
//           ANSWER: code,
//         },
//         Session: session,
//       });

//       const response = await this.cognitoClient.send(command);

//       // Check if response contains a new challenge (retry scenario with same OTP)
//       if (response.ChallengeName === 'CUSTOM_CHALLENGE' && response.Session) {
//         // Lambda decided to allow retry with the same OTP
//         throw new BadRequestException({
//           message: 'Invalid OTP. Please try again with the same OTP code.',
//           errorCode: 'INVALID_OTP_RETRY_SAME_CODE',
//           newSession: response.Session,
//           challengeName: response.ChallengeName,
//           retryAllowed: true,
//           persistentOTP: true
//         });
//       }

//       // Successful authentication
//       if (response.AuthenticationResult) {
//         return {
//           accessToken: response.AuthenticationResult.AccessToken,
//           refreshToken: response.AuthenticationResult.RefreshToken,
//           idToken: response.AuthenticationResult.IdToken,
//           message: 'Login successful',
//           user: await this.dbService.user.findOne({ phoneNumber })
//         };
//       }

//       // Unexpected response
//       throw new BadRequestException('Unexpected authentication response');

//     } catch (error) {
//       console.log('OTP Verification Error:', error);

//       // Handle specific Cognito errors
//       if (error.name === 'NotAuthorizedException') {
//         if (error.message.includes('Incorrect username or password') ||
//           error.message.includes('User authentication failed')) {
//           throw new BadRequestException({
//             message: 'Maximum OTP attempts exceeded. Please request a new OTP.',
//             errorCode: 'MAX_OTP_ATTEMPTS_EXCEEDED'
//           });
//         }

//         // Other authorization errors
//         throw new BadRequestException({
//           message: 'Authentication failed. Please generate a new OTP.',
//           errorCode: 'AUTHENTICATION_FAILED'
//         });
//       }

//       if (error.name === 'CodeMismatchException') {
//         throw new BadRequestException({
//           message: 'Invalid OTP code. Please try again with the same OTP.',
//           errorCode: 'INVALID_OTP_CODE'
//         });
//       }

//       // If it's already a BadRequestException (from our retry logic), re-throw it
//       if (error instanceof BadRequestException) {
//         throw error;
//       }

//       // Generic error
//       throw new BadRequestException('OTP verification failed');
//     }
//   }

//   // Refresh Token
//   async refreshToken(refreshTokenDto: RefreshTokenDto) {
//     try {
//       const command = new InitiateAuthCommand({
//         AuthFlow: 'REFRESH_TOKEN_AUTH',
//         ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
//         AuthParameters: {
//           'REFRESH_TOKEN': refreshTokenDto.refreshToken,
//         },
//       });

//       const response = await this.cognitoClient.send(command);

//       if (!response.AuthenticationResult) {
//         throw new UnauthorizedException('Failed to refresh token');
//       }

//       return {
//         accessToken: response.AuthenticationResult.AccessToken,
//         idToken: response.AuthenticationResult.IdToken,
//       };
//     } catch (error) {
//       throw new UnauthorizedException('Invalid refresh token');
//     }
//   }

//   // Sign Out
//   async signOut(accessToken: string, refreshToken: string) {
//     try {
//       await this.cognitoClient.send(new RevokeTokenCommand({
//         ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
//         Token: refreshToken,
//       }));
//       try {
//         await this.cognitoClient.send(new GlobalSignOutCommand({
//           AccessToken: accessToken,
//         }))
//       } catch (err) {
//         console.log(err.message);
//       }
//       return { message: 'Signed out successfully' };
//     } catch (error) {
//       throw new BadRequestException(error.message);
//     }
//   }

//   // Resend OTP
//   async resendOTP(phoneNumber: string) {
//     try {
//       const command = new ResendConfirmationCodeCommand({
//         ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
//         Username: phoneNumber,
//       });

//       await this.cognitoClient.send(command);

//       return {
//         message: 'OTP resent successfully',
//       };
//     } catch (error) {
//       throw new BadRequestException(error.message);
//     }
//   }

//   // Get User Profile : Promise<IUser>
//   async getUserProfile(accessToken: string) {
//     try {
//       const command = new GetUserCommand({
//         AccessToken: accessToken,
//       });

//       const response = await this.cognitoClient.send(command);

//       const attributes = response.UserAttributes.reduce((acc, attr) => {
//         acc[attr.Name] = attr.Value;
//         return acc;
//       }, {});

//       return {
//         id: response.Username,
//         username: attributes['preferred_username'],
//         phoneNumber: attributes['phone_number'],
//         enabled: true,
//       };
//     } catch (error) {
//       throw new UnauthorizedException('Invalid access token');
//     }
//   }

//   async updateUserPhoneNumberInCognito(oldPhoneNumber: string, newPhoneNumber: string, userId: string) {
//     try {
//       const deleteUserCommand = new AdminDeleteUserCommand({
//         UserPoolId: process.env.COGNITO_CUSTOMER_USER_POOL_ID,
//         Username: oldPhoneNumber
//       });

//       try {
//         await this.cognitoClient.send(deleteUserCommand);
//         console.log(`Successfully deleted user ${oldPhoneNumber} from Cognito`);
//       } catch (error) {
//         if (error.name === 'UserNotFoundException') {
//           console.warn(`User ${oldPhoneNumber} not found in Cognito, proceeding with creation`);
//         } else {
//           throw new Error(`Failed to delete user from Cognito: ${error.message}`);
//         }
//       }

//       const signUpUserParams: SignUpCommandInput = {
//         Username: newPhoneNumber,
//         UserAttributes: [
//           { Name: 'phone_number', Value: newPhoneNumber },
//           { Name: 'custom:userId', Value: userId }
//         ],
//         ValidationData: null,
//         Password: Helpers.generateTempPassword(),
//         ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID
//       }
//       const signUpUserCommand = new SignUpCommand(signUpUserParams);
//       await this.cognitoClient.send(signUpUserCommand);

//       return true;
//     } catch (error) {
//       console.warn('Failed to update phone number in Cognito', error);
//       throw new Error('Failed to update phone number in Cognito');
//     }
//   }

//   async generateJWTToken(user: string) {
//     try {
//       const payload = {
//         sub: user,
//         accessUserType: UserTypeEnum.ZOHO_USER,
//         iat: Math.floor(Date.now() / 1000)
//       };

//       const token = await this.jwtService.signAsync(payload);

//       return {
//         accessToken: token,
//         tokenType: 'Bearer',
//         expiresIn: '365d',
//         user
//       };
//     } catch (error) {
//       console.error('JWT Generation Error:', error);
//       throw new ErrorException('Failed to generate JWT token');
//     }
//   }
// }