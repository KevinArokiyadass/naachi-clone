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
  } from './dto/users-auth.dto';
import { RecordService } from '@noukha-technologies/mdm-core';
  
  @Injectable()
  export class UsersAuthService {
    private cognitoClient: CognitoIdentityProviderClient;
    private readonly clientId = process.env.COGNITO_CUSTOMER_APP_CLIENT_ID;
    private readonly userPoolId = process.env.COGNITO_CUSTOMER_USER_POOL_ID;
  
  constructor(
    private readonly dbService: IMongoDBServices,
    private readonly jwtService: JwtService,
    private readonly paginationService: PaginationService,
    private readonly recordService: RecordService,
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
      await this.ensurePhoneAvailable(dto.phoneNumber);
  
      const userPayload: IUsers = {
        userId: generateUniqueId(),
        phoneNumber: dto.phoneNumber,
        isActive: false,
        isVerified: false,
        isDeleted: false,
        status: 'pending',
        phoneVerified: false,
        userNameSet: false,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
  
      await this.signUpUserInCognito(dto.phoneNumber, userPayload.userId);
  
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
          isActive: true,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
        { new: true },
      );
  
      return {
        message: 'Phone number verified successfully',
        tokens,
        user: updatedUser ?? user,
      };
    }
  
    async requestLoginOtp(dto: UsersLoginDto) {
      const user = await this.getUserOrThrow(dto.phoneNumber);
  
      if (user.status !== 'completed') {
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
  
      if (user.status !== 'completed') {
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
        user: updatedUser ?? user,
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
  
      if (user.status !== 'pending') {
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
        { userId: dto.userId, status: 'pending' },
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

    async validateInstitute(email: string) {
      const atIndex = email?.lastIndexOf('@') ?? -1;
      if (atIndex === -1 || atIndex === email.length - 1) {
        throw new BadRequestException('Invalid email format');
      }

      const domain = email.substring(atIndex + 1).trim().replace(/^@/, '').toLowerCase();

      try {
        const response = await this.recordService.findAll('institutions', {
          filters: {
            $or: [
              { institutionDomain: domain }
            ],
          },
          nonPaginated: true,
        });

        const hasMatch = Array.isArray(response?.items) && response.items.length > 0;

        if (!hasMatch) {
          throw new BadRequestException({
            message: `Email domain "${domain}" is not a registered domain.`,
            errorCode: 'INVALID_EMAIL_DOMAIN',
          });
        }
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
  
      if (user.status !== 'pending') {
        throw new BadRequestException('User signup is already completed');
      }
  
    
      const existingUser = await this.dbService.users.findOne({
        email: dto.email,
        isDeleted: false,
        status: 'completed'
      });
  
      if (existingUser && existingUser.userId !== dto.userId) {
        throw new BadRequestException('Email already registered');
      }

      await this.validateInstitute(dto.email);
  
      await this.dbService.users.findOneAndUpdate(
        { userId: dto.userId, status: 'pending' },
        {
          email: dto.email,
          emailVerified: false,
          updatedAt: new Date()
        }
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
  
      if (user.status !== 'pending') {
        throw new BadRequestException('User signup is already completed');
      }
  
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
  
      await this.dbService.users.findOneAndUpdate(
        { userId: dto.userId, status: 'pending' },
        {
          emailVerified: true,
          status: 'completed',
          isActive: true,
          isVerified: true,
          updatedAt: new Date()
        }
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
        user,
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

    async findAllUsers(
      skip: number = 0,
      limit: number = 10,
      filter: Record<string, any> = {},
      nonPaginated: boolean
    ): Promise<IPaginatedResult<IUsers[]>> {
      filter.isDeleted = { $in: [null, false] };
      const users = await this.paginationService.findAndPaginate(this.dbService.users, { skip, limit, filter, nonPaginated });
      return users;
    }

  }
  
  