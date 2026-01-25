import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AdminUpdateUserAttributesCommand,
  AuthFlowType,
  CognitoIdentityProviderClient,
  GetUserAttributeVerificationCodeCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  SignUpCommand,
  SignUpCommandInput,
  VerifyUserAttributeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { JwtService } from '@nestjs/jwt';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { IUsers } from 'src/common/interfaces/users.interface';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { ReferrerMedium, USER_STATUS } from 'src/common/enums/user.enum';
import { generateRandomPassword, generateUniqueId } from 'src/common/utils/util';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import {
  ConfirmEmailDto,
  SetUsernameDto,
  UsersLoginDto,
  UsersSignupDto,
  UsersVerifyLoginDto,
  UsersVerifySignupDto,
  VerifyEmailDto,
  UnifiedPhoneOtpRequestDto,
  UnifiedPhoneOtpVerifyDto,
} from './dto/users-auth.dto';
import { RecordService } from '@noukha-technologies/mdm-core';
import { response } from 'express';
import { UpdateUserProfileDto } from './dto/user-profile.dto';
import { AwsStoreService } from '../aws-store/aws-store.service';
import { ConfigurationService } from '../configuration/configuration.service';


@Injectable()
export class UsersAuthService {
  private cognitoClient: CognitoIdentityProviderClient;
  private readonly clientId = process.env.COGNITO_CUSTOMER_APP_CLIENT_ID;
  private readonly userPoolId = process.env.COGNITO_CUSTOMER_USER_POOL_ID;
  private readonly DEFAULT_EMAIL_OTP = '643211';

  constructor(
    private readonly dbService: IMongoDBServices,
    private readonly jwtService: JwtService,
    private readonly paginationService: PaginationService,
    private readonly recordService: RecordService,
    private readonly awsStoreService: AwsStoreService,
    private readonly configurationService: ConfigurationService,
  ) {
    if (!this.clientId) {
      throw new Error('COGNITO_CUSTOMER_APP_CLIENT_ID is not configured');
    }
    if (!this.userPoolId) {
      throw new Error('COGNITO_CUSTOMER_USER_POOL_ID is not configured');
    }
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async signup(dto: UsersSignupDto) {
    // Check signup restrictions before proceeding
    await this.checkSignupRestrictions();
    
    await this.ensurePhoneAvailable(dto.phoneNumber);

    const userPayload: IUsers = {
      userId: generateUniqueId(),
      phoneNumber: dto.phoneNumber,
      isVerified: false,
      isDeleted: false,
      status: USER_STATUS.PENDING,
      phoneVerified: false,
      userNameSet: false,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await this.signUpUserInCognito(dto.phoneNumber, userPayload.userId);
    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        // For sync users, isVerified will be set later when institutionId is synced (email match only)
        const syncUserPayload: IUsers = {
          userId: generateUniqueId(),
          phoneNumber: dto.phoneNumber,
          customLogin: true,
          status: USER_STATUS.ACTIVE,
          isVerified: false, // Will be set to true when institutionId is synced (email match only)
          phoneVerified: true,
          userNameSet: false,
          emailVerified: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const otpResponse = await this.generateOtp(dto.phoneNumber);
        await this.dbService.users.create(syncUserPayload);

        return {
          message: 'User synchronized and OTP sent to phone number',
          challengeName: otpResponse.ChallengeName,
          session: otpResponse.Session,
          userId: syncUserPayload.userId,
        };
      }
      this.handleCognitoSignupError(error);
    }

    const otpResponse = await this.generateOtp(dto.phoneNumber);

    await this.dbService.users.create(userPayload);

    return {
      message: 'OTP sent to phone number',
      challengeName: otpResponse.ChallengeName,
      session: otpResponse.Session,
      userId: userPayload.userId,
    };
  }

  async verifySignupOtp(dto: UsersVerifySignupDto) {
    const user = await this.getUserOrThrow(dto.phoneNumber);

    let response;
    try {
      response = await this.respondToOtpChallenge(
        dto.phoneNumber,
        dto.otp,
        dto.session,
      );
    } catch (error) {
      this.handleOtpChallengeError(error);
    }

    const tokens = this.extractAuthResult(response);

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { phoneNumber: dto.phoneNumber, isDeleted: false },
      {
        phoneVerified: true,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    );

    return {
      message: 'Phone number verified successfully',
      tokens,
      user: this.attachProfileImageUrl(updatedUser ?? user),
    };
  }


  async requestLoginOtp(dto: UsersLoginDto) {
    const user = await this.getUserOrThrow(dto.phoneNumber);

    if (user.status !== USER_STATUS.ACTIVE) {
      throw new BadRequestException(
        'Complete email verification before logging in.',
      );
    }

    const otpResponse = await this.generateOtp(dto.phoneNumber);

    return {
      message: 'OTP sent to phone number',
      challengeName: otpResponse.ChallengeName,
      session: otpResponse.Session,
    };
  }

  async verifyLoginOtp(dto: UsersVerifyLoginDto) {
    const user = await this.getUserOrThrow(dto.phoneNumber);

    if (user.status !== USER_STATUS.ACTIVE) {
      throw new BadRequestException(
        'Complete email verification before logging in.',
      );
    }

    let response;
    try {
      response = await this.respondToOtpChallenge(
        dto.phoneNumber,
        dto.otp,
        dto.session,
      );
    } catch (error) {
      this.handleOtpChallengeError(error);
    }

    const tokens = this.extractAuthResult(response);

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { phoneNumber: dto.phoneNumber, isDeleted: false },
      {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    );

    return {
      message: 'Login successful',
      tokens,
      user: this.attachProfileImageUrl(updatedUser ?? user),
    };
  }

  async requestUnifiedPhoneOtp(dto: UnifiedPhoneOtpRequestDto) {
    const { phoneNumber } = dto;

    const existingUser = await this.dbService.users.findOne({
      phoneNumber,
      isDeleted: false,
    });

    if (!existingUser) {
      // Check signup restrictions before allowing new signup
      await this.checkSignupRestrictions();

      const signupResult = await this.signup({ phoneNumber } as UsersSignupDto);

      return {
        authMode: 'signup',
        ...signupResult,
      };
    }
    
    // Existing user - check if they can continue signup or should login
    if (existingUser.status === USER_STATUS.ACTIVE) {
      // Active users can always login
      const loginResult = await this.requestLoginOtp({ phoneNumber } as UsersLoginDto);

      return {
        authMode: 'login',
        ...loginResult,
      };
    }

    // Existing user but not active - check restrictions before allowing them to continue signup
    await this.checkSignupRestrictions();

    if (existingUser.phoneVerified) {
      const reverifyPhone = await this.generateOtp(phoneNumber);
      return {
        authMode: 'signup',
        message: 'reverifying Phone continue signup',
        userId: existingUser.userId,
        challengeName: reverifyPhone.ChallengeName,
        session: reverifyPhone.Session
      };
    }

    const otpResponse = await this.generateOtp(phoneNumber);

    return {
      authMode: 'signup',
      message: 'OTP sent to phone number',
      challengeName: otpResponse.ChallengeName,
      session: otpResponse.Session,
      userId: existingUser.userId,
    };
  }

  async verifyUnifiedPhoneOtp(dto: UnifiedPhoneOtpVerifyDto) {
    const { phoneNumber, otp, session } = dto;

    const user = await this.dbService.users.findOne({
      phoneNumber,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === USER_STATUS.ACTIVE) {
      const loginResult = await this.verifyLoginOtp({
        phoneNumber,
        otp,
        session,
      } as UsersVerifyLoginDto);

      return {
        authMode: 'login',
        ...loginResult,
      };
    }


    const signupResult = await this.verifySignupOtp({
      phoneNumber,
      otp,
      session,
    } as UsersVerifySignupDto);

    return {
      authMode: 'signup',
      nextStep: 'setUsername',
      message: 'Phone verified successfully. Continue signup.',
      userId: signupResult.user?.userId ?? user.userId,
      tokens: signupResult.tokens,
    };
  }

  async resendUnifiedPhoneOtp(dto: UnifiedPhoneOtpRequestDto) {
    const { phoneNumber } = dto;

    const user = await this.dbService.users.findOne({
      phoneNumber,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === USER_STATUS.ACTIVE) {
      const loginResult = await this.requestLoginOtp({ phoneNumber } as UsersLoginDto);
      return {
        authMode: 'login',
        ...loginResult,
      };
    }

    await this.resendSignupOtp(phoneNumber);
    return {
      authMode: 'signup',
      message: 'OTP resent successfully',
      userId: user.userId,
    };
  }

  async checkAvailableUserName(userName: string) {
    const user = await this.dbService.users.findOne({
      userName,
      isDeleted: false
    });
    if (user) {
      throw new BadRequestException('Username already taken');
    }
    return {
      message: 'Username available'
    };
  }

  async setUsername(dto: SetUsernameDto) {
    const user = await this.dbService.users.findOne({
      userId: dto.userId,
      isDeleted: false
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phoneVerified) {
      throw new BadRequestException('Phone number must be verified first');
    }

    if (user.status !== USER_STATUS.PENDING) {
      throw new BadRequestException('User signup is already completed');
    }


    const existingUser = await this.dbService.users.findOne({
      userName: dto.userName,
      isDeleted: false
    });

    if (existingUser && existingUser.userId !== dto.userId) {
      throw new BadRequestException('Username already taken');
    }


    await this.dbService.users.findOneAndUpdate(
      { userId: dto.userId, status: USER_STATUS.PENDING },
      {
        userName: dto.userName,
        name: dto.name,
        userNameSet: true,
        updatedAt: new Date()
      }
    );

    return {
      message: 'Username set successfully'
    };
  }

  async validateInstitute(email: string): Promise<string> {
    const atIndex = email?.lastIndexOf('@') ?? -1;
    if (atIndex === -1 || atIndex === email.length - 1) {
      throw new BadRequestException('Invalid email format');
    }

    const domain = email.substring(atIndex + 1).trim().replace(/^@/, '').toLowerCase();

    try {
      // Search for domain with or without @ prefix to handle both cases in database
      const response = await this.recordService.findAll('institutions', {
        filters: {
          $or: [
            { institutionDomain: domain },
            { institutionDomain: `@${domain}` }
          ],
        },
        fields: ['institutionDomain', 'institutionsId'],
        nonPaginated: true,
      });

      const hasMatch = Array.isArray(response?.items) && response.items.length > 0;

      if (!hasMatch) {
        throw new BadRequestException({
          message: `Email domain "${domain}" is not a registered domain.`,
          errorCode: 'INVALID_EMAIL_DOMAIN',
        });
      }

      const matchingInstitution = response.items[0];
      if (!matchingInstitution?.institutionsId) {
        throw new BadRequestException({
          message: 'Institution ID not found for the matching domain.',
          errorCode: 'INSTITUTION_ID_MISSING',
        });
      }

      return matchingInstitution.institutionsId;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException({
        message: 'Failed to validate email domain. Please try again.',
        errorCode: 'DOMAIN_VALIDATION_ERROR',
      });
    }
  }

  /**
   * Syncs institutionId from admin user to regular user if emails match
   * Returns object with institutionId (phone number check removed - phone numbers can differ)
   */
  private async syncInstitutionIdFromAdminUser(
    email: string,
    userPhoneNumber: string
  ): Promise<{ institutionId: string } | null> {
    const adminUser = await this.dbService.adminUser.findOne({
      email: email.toLowerCase().trim(),
      isDeleted: { $ne: true }
    });

    if (!adminUser) {
      return null;
    }

    // Get institutionId from admin user's metaTags
    if (adminUser.metaTags && adminUser.metaTags.length > 0 && adminUser.metaTags[0].institutionsId) {
      return {
        institutionId: adminUser.metaTags[0].institutionsId
      };
    }

    return null;
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.dbService.users.findOne({
      userId: dto.userId,
      isDeleted: false
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phoneVerified) {
      throw new BadRequestException('Phone number must be verified first');
    }

    if (!user.userNameSet || !user.userName) {
      throw new BadRequestException('Username must be set first');
    }

    const existingUser = await this.dbService.users.findOne({
      email: dto.email,
      isDeleted: false,
      status: USER_STATUS.ACTIVE
    });

    if (existingUser && existingUser.userId !== dto.userId) {
      throw new BadRequestException('Email already registered');
    }

    // Check for matching admin user and sync institutionId
    const adminSyncResult = await this.syncInstitutionIdFromAdminUser(dto.email, user.phoneNumber);

    const institutionsId = adminSyncResult?.institutionId || await this.validateInstitute(dto.email);

    const updatePayload: Record<string, any> = {
      email: dto.email,
      institutionsId: institutionsId,
      emailVerified: false,
      qrAuth: false,
      updatedAt: new Date()
    };

    // Only set referrerMedium during initial signup flow when it is not already set
    if (!user.referrerMedium && user.status === USER_STATUS.PENDING) {
      updatePayload.referrerMedium = ReferrerMedium.INSTITUTION_MAIL;
    }

    // Set isVerified to true if institutionId exists from admin user (email match only, phone numbers can differ)
    if (adminSyncResult && adminSyncResult.institutionId) {
      updatePayload.isVerified = true;
    }

    await this.dbService.users.findOneAndUpdate(
      { userId: dto.userId, isDeleted: false },
      updatePayload
    );


    try {
      await this.cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: this.userPoolId,
          Username: user.phoneNumber,
          UserAttributes: [
            { Name: 'email', Value: dto.email },
            { Name: 'email_verified', Value: 'false' }
          ]
        })
      );
    } catch (error) {
      console.error('Failed to update email in Cognito:', error);
      throw new BadRequestException('Failed to update email. Please try again.');
    }

    try {
      await this.cognitoClient.send(
        new GetUserAttributeVerificationCodeCommand({
          AccessToken: dto.accessToken,
          AttributeName: 'email'
        })
      );
    } catch (error) {
      console.error('Failed to request email verification code:', error);
      throw new BadRequestException('Failed to send verification code. Please try again.');
    }

    return {
      message: 'Verification code sent to your email'
    };
  }

  async confirmEmail(dto: ConfirmEmailDto) {
    const user = await this.dbService.users.findOne({
      userId: dto.userId,
      isDeleted: false
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phoneVerified) {
      throw new BadRequestException('Phone number must be verified first');
    }

    if (!user.userNameSet) {
      throw new BadRequestException('Username must be set first');
    }

    if (user.email !== dto.email) {
      throw new BadRequestException('Email does not match the one provided during verification');
    }

    // Check if default OTP is used
    if (dto.confirmationCode === this.DEFAULT_EMAIL_OTP) {
      const isPendingSignup = user.status === USER_STATUS.PENDING;

      // Preserve isVerified if it was set during verifyEmail (from admin sync)
      const updatePayload: Record<string, any> = {
        emailVerified: true,
        updatedAt: new Date()
      };

      if (isPendingSignup) {
        updatePayload.status = USER_STATUS.ACTIVE;
        updatePayload.isVerified = user.isVerified ?? false; // Preserve existing value, default to false

        // Only set referrerMedium during initial signup flow when it is not already set
        if (!user.referrerMedium) {
          updatePayload.referrerMedium = ReferrerMedium.INSTITUTION_MAIL;
        }

        updatePayload.qrAuth = false;
      }

      // Skip Cognito verification and directly mark as completed (or just mark emailVerified for existing users)
      await this.dbService.users.findOneAndUpdate(
        { userId: dto.userId, isDeleted: false },
        updatePayload
      );

      return {
        message: 'Email verified successfully. Signup completed!'
      };
    }

    // Proceed with Cognito verification for non-default OTP
    try {
      await this.cognitoClient.send(
        new VerifyUserAttributeCommand({
          AccessToken: dto.accessToken,
          AttributeName: 'email',
          Code: dto.confirmationCode
        })
      );
    } catch (error) {
      console.error('Failed to verify email code:', error);
      if (error.name === 'CodeMismatchException') {
        throw new UnauthorizedException('Invalid verification code');
      }
      if (error.name === 'ExpiredCodeException') {
        throw new UnauthorizedException('Verification code has expired. Please request a new one.');
      }
      throw new BadRequestException('Failed to verify email. Please try again.');
    }

    const isPendingSignup = user.status === USER_STATUS.PENDING;

    // Preserve isVerified if it was set during verifyEmail (from admin sync)
    const updatePayload: Record<string, any> = {
      emailVerified: true,
      updatedAt: new Date()
    };

    if (isPendingSignup) {
      updatePayload.status = USER_STATUS.ACTIVE;
      updatePayload.isVerified = user.isVerified ?? false; // Preserve existing value, default to false

      // Only set referrerMedium during initial signup flow when it is not already set
      if (!user.referrerMedium) {
        updatePayload.referrerMedium = ReferrerMedium.INSTITUTION_MAIL;
      }

      updatePayload.qrAuth = false;
    }

    await this.dbService.users.findOneAndUpdate(
      { userId: dto.userId, isDeleted: false },
      updatePayload
    );

    return {
      message: 'Email verified successfully. Signup completed!'
    };
  }


  async resendSignupOtp(phoneNumber: string) {
    await this.getUserOrThrow(phoneNumber);

    const command = new ResendConfirmationCodeCommand({
      ClientId: this.clientId,
      Username: phoneNumber,
    });

    await this.cognitoClient.send(command);

    return { message: 'OTP resent successfully' };
  }

  async refreshToken(refreshToken: string) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await this.cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('Failed to refresh token');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(accessToken: string, refreshToken: string) {
    try {
      await this.cognitoClient.send(
        new RevokeTokenCommand({
          ClientId: this.clientId,
          Token: refreshToken,
        }),
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
    }

    try {
      await this.cognitoClient.send(
        new GlobalSignOutCommand({
          AccessToken: accessToken,
        }),
      );
    } catch {
    }

    return { message: 'Signed out successfully' };
  }

  async generateAppJwt(userId: string) {
    const user = await this.dbService.users.findOne({
      userId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const payload: Record<string, any> = {
      userId: user.userId,
      phoneNumber: user.phoneNumber,
      iat: Math.floor(Date.now() / 1000),
    };

    if (user.email) {
      payload.email = user.email;
    }

    if (user.userName) {
      payload.userName = user.userName;
    }

    const token = await this.jwtService.signAsync(payload);

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: '365d',
      user: this.attachProfileImageUrl(user),
    };
  }

  private async signUpUserInCognito(phoneNumber: string, userId: string) {
    const params: SignUpCommandInput = {
      Username: phoneNumber,
      UserAttributes: [
        { Name: 'phone_number', Value: phoneNumber },
        { Name: 'custom:userId', Value: userId },
      ],
      Password: generateRandomPassword(),
      ClientId: this.clientId,
    };

    const command = new SignUpCommand(params);
    await this.cognitoClient.send(command);
  }

  private async generateOtp(phoneNumber: string) {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.CUSTOM_AUTH,
      AuthParameters: {
        USERNAME: phoneNumber,
      },
      ClientId: this.clientId,
    });

    return this.cognitoClient.send(command);
  }

  private async respondToOtpChallenge(
    phoneNumber: string,
    otp: string,
    session?: string,
  ) {
    const command = new RespondToAuthChallengeCommand({
      ChallengeName: 'CUSTOM_CHALLENGE',
      ClientId: this.clientId,
      ChallengeResponses: {
        USERNAME: phoneNumber,
        ANSWER: otp,
      },
      Session: session,
    });

    return this.cognitoClient.send(command);
  }

  private extractAuthResult(response: any) {
    if (
      response.ChallengeName === 'CUSTOM_CHALLENGE' &&
      response.Session
    ) {
      throw new BadRequestException({
        message: 'Invalid OTP. Please double-check the code and try again.',
        errorCode: 'INVALID_OTP_RETRY_SAME_CODE',
        session: response.Session,
        challengeName: response.ChallengeName,
        retryAllowed: true,
        persistentOTP: true,
      });
    }

    if (!response.AuthenticationResult) {
      throw new BadRequestException('Unexpected authentication response');
    }

    return response.AuthenticationResult;
  }

  private handleOtpChallengeError(error: any) {
    const name = error?.name;
    if (name === 'NotAuthorizedException' || name === 'CodeMismatchException') {
      throw new BadRequestException({
        message: 'Invalid OTP. Please double-check the code and try again.',
        errorCode: 'INVALID_OTP_CODE',
      });
    }

    throw new BadRequestException('Invalid OTP. Please double-check the code and try again.');
  }

  private handleCognitoSignupError(error: any) {
    const name = error?.name;
    const message = error?.message || '';

    if (name === 'InvalidParameterException') {
      if (message.includes('phone number') || message.includes('phone_number')) {
        throw new BadRequestException({
          message: 'Invalid phone number format. Please provide a valid phone number.',
          errorCode: 'INVALID_PHONE_FORMAT',
        });
      }
      throw new BadRequestException({
        message: message || 'Invalid parameters provided.',
        errorCode: 'INVALID_PARAMETERS',
      });
    }

    if (name === 'UsernameExistsException') {
      throw new BadRequestException({
        message: 'Phone number already registered.',
        errorCode: 'PHONE_ALREADY_EXISTS',
      });
    }

    throw error;
  }

  private async ensurePhoneAvailable(phoneNumber: string) {
    const existing = await this.dbService.users.findOne({
      phoneNumber,
      isDeleted: false,
    });

    if (existing) {
      throw new BadRequestException('Phone number already registered');
    }
  }

  private async getUserOrThrow(phoneNumber: string) {
    const user = await this.dbService.users.findOne({
      phoneNumber,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async checkSignupRestrictions() {
    // Get configuration from ConfigurationService
    const config = await this.configurationService.getConfiguration();

    // If forceRestrictOnboarding is false, allow signup
    if (!config.forceRestrictOnboarding) {
      return;
    }

    // Count all users regardless of status (excluding deleted)
    const totalUserCount = await this.dbService.users.countDocuments({
      isDeleted: false,
    });

    // Debug logging
    console.log(`[Signup Restriction Check] Total users: ${totalUserCount}, Allowed: ${config.allowedUserCount}, ForceRestrict: ${config.forceRestrictOnboarding}`);

    // If user count exceeds or equals allowed count, block signup
    if (totalUserCount >= config.allowedUserCount) {
      console.log(`[Signup Restriction] Blocking signup - Total users (${totalUserCount}) >= Allowed (${config.allowedUserCount})`);
      throw new BadRequestException({
        message: 'Signup being temporarily unavailable kindly contact admin',
        errorCode: 'SIGNUP_RESTRICTED',
      });
    }
  }

  async getUsersByPhoneNumbers(
    phoneNumbers: string[],
    ownerId?: string,
  ): Promise<
    {
      phoneNumber: string;
      name?: string;
      userName?: string;
      userId?: string;
      connection?: any;
      request?: any;
    }[]
  > {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return [];
    }

    const matchStage: any = {
      phoneNumber: { $in: phoneNumbers },
      isDeleted: false,
      status: USER_STATUS.ACTIVE,
    };

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $project: {
          _id: 0,
          userId: 1,
          phoneNumber: 1,
          name: 1,
          userName: 1,
        },
      },
    ];

    if (ownerId) {
      pipeline.push(
        // 1) Look for existing connection between owner and this user
        {
          $lookup: {
            from: 'connections',
            let: { peerUserId: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$ownerId', ownerId] },
                      { $eq: ['$peerId', '$$peerUserId'] },
                      { $eq: ['$isDeleted', false] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
            ],
            as: 'connection',
          },
        },
        // 2) If no connection, look for pending friend request from owner to this user
        {
          $lookup: {
            from: 'requests',
            let: {
              peerUserId: '$userId',
              hasConnectionCount: { $size: '$connection' },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      // Only when there is no connection
                      { $eq: ['$$hasConnectionCount', 0] },
                      { $eq: ['$actorId', ownerId] },
                      {
                        $or: [
                          { $eq: ['$targetId', '$$peerUserId'] },
                          {
                            // fallback: match via metadata.targetUserId when present
                            $eq: ['$metadata.targetUserId', '$$peerUserId'],
                          },
                        ],
                      },
                      { $eq: ['$targetType', 'user'] },
                      { $eq: ['$status', 'pending'] },
                      { $eq: ['$isDeleted', false] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
              {
                $project: {
                  _id: 0,
                  requestId: 1,
                  type: 1,
                  actorId: 1,
                  targetId: 1,
                  targetType: 1,
                  status: 1,
                  reqType: 1,
                  expiresAt: 1,
                  attempt: 1,
                  previousRequestId: 1,
                  idempotencyKey: 1,
                  blockedUntil: 1,
                  isDeleted: 1,
                  metadata: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
            ],
            as: 'request',
          },
        },
        {
          $addFields: {
            connection: { $arrayElemAt: ['$connection', 0] },
            request: { $arrayElemAt: ['$request', 0] },
          },
        },
      );
    }

    const usersWithConnections = await this.dbService.users.aggregate<any>(
      pipeline,
    );

    return usersWithConnections.map((u: any) =>
      this.attachProfileImageUrl(u),
    );
  }

  async findAllUsers(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean
  ): Promise<IPaginatedResult<IUsers[]>> {
    filter.isDeleted = { $in: [null, false] };
    const result = await this.paginationService.findAndPaginate(this.dbService.users, { skip, limit, filter, nonPaginated });

    // Transform profileImage field to include CloudFront URL for each user
    if (result.items && Array.isArray(result.items)) {
      result.items = result.items.map((user: any) => this.attachProfileImageUrl(user));
    }

    return result;
  }

  async activateByQrCode(userId: string, referrerUserId: string) {
    // Check if the user exists
    const user = await this.dbService.users.findOne({
      userId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has already completed signup
    if (user.status === USER_STATUS.ACTIVE) {
      throw new BadRequestException('User signup is already completed. Cannot activate via QR code.');
    }

    // Verify that the referrer user exists
    const referrer = await this.dbService.users.findOne({
      userId: referrerUserId,
      isDeleted: false,
    });

    if (!referrer) {
      throw new NotFoundException('Referrer user not found');
    }

    // Prevent self-referral
    if (userId === referrerUserId) {
      throw new BadRequestException('Cannot refer yourself');
    }

    const referrerUserName = referrer.userName ?? referrerUserId;

    // Update user: activate, set referrer, and set activation medium
    // Only set isVerified to true if institutionId exists
    const updateData: Record<string, any> = {
      status: USER_STATUS.ACTIVE,
      referrerId: referrerUserId,
      referredBy: referrerUserName,
      referrerMedium: ReferrerMedium.QR_CODE,
      qrAuth: true,
      updatedAt: new Date(),
    };

    // Only set isVerified to true if institutionId exists
    if (user.institutionsId) {
      updateData.isVerified = true;
    }

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { userId, isDeleted: false },
      updateData,
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('Failed to update user');
    }

    return {
      message: 'User activated successfully via QR code',
      user: this.attachProfileImageUrl(updatedUser),
    };
  }

  private attachProfileImageUrl(user: any): any {
    if (!user) return user;

    const userObj = user.toObject ? user.toObject() : { ...user };

    if (userObj.profileImage) {
      userObj.profileImage = this.awsStoreService.getCloudFrontUrl(userObj.profileImage);
    }

    // Delete password if present to ensure it's not leaked in responses
    delete userObj.password;

    return userObj;
  }

  async getUserByUserId(userId: string) {
    const user = await this.dbService.users.findOne({
      userId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userWithImage = this.attachProfileImageUrl(user);

    // Populate institution details if institutionsId exists
    if (userWithImage.institutionsId) {
      try {
        const institution = await this.recordService.findOne('institutions', userWithImage.institutionsId);
        if (institution) {
          // Convert institution to plain object to ensure we can add fields
          const institutionObj = institution.toObject ? institution.toObject() : { ...institution };

          // Convert s3ProfileImageName to CloudFront URL if present
          if (institutionObj.s3ProfileImageName) {
            institutionObj.s3ProfileImageUrl = this.awsStoreService.getCloudFrontUrl(institutionObj.s3ProfileImageName);
          }

          userWithImage.institutionDetails = institutionObj;
        }
      } catch (error) {
        // If institution not found or error occurs, continue without institution details
        console.error('Error fetching institution details:', error);
      }
    }

    // Populate department details if user email matches admin user email
    if (userWithImage.email && userWithImage.institutionsId) {
      try {
        const adminUser = await this.dbService.adminUser.findOne({
          email: userWithImage.email.toLowerCase().trim(),
          isDeleted: { $ne: true }
        });

        if (adminUser && adminUser.metaTags && adminUser.metaTags.length > 0) {
          // Find the metaTag that matches the user's institutionsId
          const matchingMetaTag = adminUser.metaTags.find(
            (tag: any) => tag && tag.institutionsId && String(tag.institutionsId).trim() === String(userWithImage.institutionsId).trim()
          );

          if (matchingMetaTag && matchingMetaTag.departmentsId && Array.isArray(matchingMetaTag.departmentsId) && matchingMetaTag.departmentsId.length > 0) {
            // Fetch department details using departmentsId array
            // Query by matching any of the departmentsId values
            const departmentsResult = await this.recordService.findAll('departments', {
              filters: {
                departmentsId: { $in: matchingMetaTag.departmentsId }
              },
              nonPaginated: true,
            });

            if (departmentsResult?.items && departmentsResult.items.length > 0) {
              userWithImage.departmentDetails = departmentsResult.items;
            }
          }
        }
      } catch (error) {
        // If admin user not found or error occurs, continue without department details
        console.error('Error fetching department details:', error);
      }
    }

    // Populate referrer details if referrerId exists
    if (userWithImage.referrerId) {
      try {
        const referrer = await this.dbService.users.findOne({
          userId: userWithImage.referrerId,
          isDeleted: false,
        });
        if (referrer) {
          userWithImage.referrerDetails = this.attachProfileImageUrl(referrer);
        }
      } catch (error) {
        console.error('Error fetching referrer details:', error);
      }
    }

    // For institution referral: ensure referredBy is institution name when we have it
    const isInstitutionReferral =
      userWithImage.referrerMedium === ReferrerMedium.INSTITUTION_MAIL ||
      userWithImage.referrerMedium === 'institutionMail';
    if (
      isInstitutionReferral &&
      userWithImage.institutionDetails?.institutionName &&
      !userWithImage.referredBy
    ) {
      userWithImage.referredBy =
        userWithImage.institutionDetails.institutionName;
    }

    return userWithImage;
  }

  async updateUserProfile(userId: string, dto: UpdateUserProfileDto) {
    const user = await this.dbService.users.findOne({
      userId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) {
      updatePayload.name = dto.name;
    }

    if (dto.userName !== undefined) {
      // Check if username is already taken by another user
      if (dto.userName) {
        const existingUser = await this.dbService.users.findOne({
          userName: dto.userName,
          isDeleted: false,
        });

        if (existingUser && existingUser.userId !== userId) {
          throw new BadRequestException('Username already taken');
        }
      }
      updatePayload.userName = dto.userName;
    }

    if (dto.s3FileName !== undefined) {
      updatePayload.profileImage = dto.s3FileName;
      updatePayload.profileImageUpdatedAt = new Date();
    }

    if (dto.showPhoneNumber !== undefined) {
      updatePayload.showPhoneNumber = dto.showPhoneNumber;
    }

    if (dto.muteNotifications !== undefined) {
      updatePayload.muteNotifications = dto.muteNotifications;
    }

    if (dto.disableReadReceipt !== undefined) {
      updatePayload.disableReadReceipt = dto.disableReadReceipt;
    }

    if (dto.status !== undefined) {
      updatePayload.status = dto.status;
    }

    if (dto.referrerMedium !== undefined) {
      updatePayload.referrerMedium = dto.referrerMedium;
    }

    // When referrerMedium is set to institution referral and user has referrerId, set referredBy to institution name
    if (
      dto.referrerMedium === ReferrerMedium.INSTITUTION_MAIL &&
      user.referrerId &&
      dto.referrerId !== null &&
      dto.referrerId !== ''
    ) {
      try {
        const referrer = await this.dbService.users.findOne({
          userId: user.referrerId,
          isDeleted: false,
        });
        if (referrer?.institutionsId) {
          const institution = await this.recordService.findOne(
            'institutions',
            referrer.institutionsId,
          );
          const institutionObj = institution?.toObject
            ? institution.toObject()
            : institution;
          updatePayload.referredBy =
            institutionObj?.institutionName ??
            referrer.userName ??
            user.referrerId;
        }
      } catch {
        // Keep existing referredBy on error
      }
    }

    if (dto.referrerId !== undefined) {
      if (dto.referrerId) {
        const referrer = await this.dbService.users.findOne({
          userId: dto.referrerId,
          isDeleted: false,
        });
        if (!referrer) {
          throw new BadRequestException('Referrer user not found');
        }
        if (dto.referrerId === userId) {
          throw new BadRequestException('Cannot set yourself as referrer');
        }
        updatePayload.referrerId = dto.referrerId;

        const effectiveReferrerMedium =
          dto.referrerMedium ?? user.referrerMedium;
        const isInstitutionReferral =
          effectiveReferrerMedium === ReferrerMedium.INSTITUTION_MAIL;

        if (isInstitutionReferral && referrer.institutionsId) {
          try {
            const institution = await this.recordService.findOne(
              'institutions',
              referrer.institutionsId,
            );
            const institutionObj = institution?.toObject
              ? institution.toObject()
              : institution;
            updatePayload.referredBy =
              institutionObj?.institutionName ??
              referrer.userName ??
              dto.referrerId;
          } catch {
            updatePayload.referredBy =
              referrer.userName ?? dto.referrerId;
          }
        } else {
          updatePayload.referredBy = referrer.userName ?? dto.referrerId;
        }
      } else {
        updatePayload.referrerId = null;
        updatePayload.referredBy = null;
      }
    }

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { userId, isDeleted: false },
      updatePayload,
      { new: true },
    );

    return {
      message: 'Profile updated successfully',
      user: this.attachProfileImageUrl(updatedUser),
    };
  }

}


