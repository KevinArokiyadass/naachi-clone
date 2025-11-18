import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthFlowType,
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  SignUpCommand,
  SignUpCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';
import { JwtService } from '@nestjs/jwt';
import { nanoid } from 'nanoid';

import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { IUsers } from 'src/common/interfaces/users.interface';
import { generateRandomPassword } from 'src/common/utils/util';
import {
  UsersLoginDto,
  UsersSignupDto,
  UsersVerifyLoginDto,
  UsersVerifySignupDto,
} from './dto/users-auth.dto';

@Injectable()
export class UsersPhoneAuthService {
  private cognitoClient: CognitoIdentityProviderClient;
  private readonly clientId = process.env.COGNITO_CUSTOMER_APP_CLIENT_ID;

  constructor(
    private readonly dbService: IMongoDBServices,
    private readonly jwtService: JwtService,
  ) {
    if (!this.clientId) {
      throw new Error('COGNITO_CUSTOMER_APP_CLIENT_ID is not configured');
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
      userId: nanoid(),
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

    const response = await this.respondToOtpChallenge(
      dto.phoneNumber,
      dto.otp,
      dto.session,
    );

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

    const response = await this.respondToOtpChallenge(
      dto.phoneNumber,
      dto.otp,
      dto.session,
    );

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
      // Ignore invalid/expired access tokens
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
        message: 'Invalid OTP. Please try again with the same OTP code.',
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

  private async ensurePhoneAvailable(phoneNumber: string) {
    const existing = await this.dbService.users.findOne({
      phoneNumber,
      isDeleted: false,
    });

    if (existing) {
      throw new BadRequestException('Phone number already registered');
    }
  }

  private async ensureEmailAvailable(email: string) {
    if (!email) {
      return;
    }
    const existing = await this.dbService.users.findOne({
      email,
      isDeleted: false,
    });

    if (existing) {
      throw new BadRequestException('Email already registered');
    }
  }

  private async ensureUsernameAvailable(userName: string) {
    if (!userName) {
      return;
    }
    const existing = await this.dbService.users.findOne({
      userName,
      isDeleted: false,
    });

    if (existing) {
      throw new BadRequestException('Username already taken');
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
}

