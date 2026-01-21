import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  AuthFlowType,
  RespondToAuthChallengeCommand,
  SignUpCommandInput,
  AdminDeleteUserCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { ErrorException } from 'src/common/errors/custom-error.exception';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { IUsers } from 'src/common/interfaces/users.interface';
import { nanoid } from 'nanoid';
import { generateRandomPassword } from 'src/common/utils/util';
import { JwtService } from '@nestjs/jwt';
import { USER_STATUS } from 'src/common/enums/user.enum';

// DTOs for OTP verification and token refresh
export class VerifyOtpDto {
  phoneNumber: string;
  code: string;
  session: string;
}

export class RefreshTokenDto {
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private cognitoClient: CognitoIdentityProviderClient;

  constructor(
    private dbService: IMongoDBServices,
    private readonly jwtService: JwtService
  ) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  // Create a user in Cognito with phone number as username
  async createUser(phoneNumber: string, name: string, businessName: string, emailId: string, gstNumber: string, industryType: string, serviceableArea: string) {
    try {
      const userDetail = await this.dbService.users.findOne({ 
        phoneNumber, 
        isDeleted: false 
      });
      if (userDetail) {
        throw new BadRequestException({ message: 'User already Exists', errorCode: "USER_ALREADY_EXIST" });
      } else {
        const userDetail: IUsers = {
          userId: nanoid(),
          Name: name,
          phoneNumber,
          email: emailId,
          userName: businessName,
          isVerified: false,
          isDeleted: false,
          otp: generateRandomPassword(6),
          otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
          lastLoginAt: null,
          status: USER_STATUS.PENDING,
          phoneVerified: false,
          userNameSet: true,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        await this.signUpUserInCognito(phoneNumber, name, userDetail.userId)
        const initResponse = await this.generateOtp(phoneNumber)
        const createdUser = await this.dbService.users.create(userDetail);
        return {
          message: 'OTP sent successfully',
          user: userDetail,
          challengeName: initResponse.ChallengeName,
          session: initResponse.Session,
        };
      }
    } catch (error) {
      console.log(error)
      if (error instanceof BadRequestException) {
        const { message = "", errorCode = "" } = error.getResponse() as Record<string, any>;
        throw new BadRequestException({ message, errorCode });
      }
      throw new ErrorException('Failed to create user in Cognito');
    }
  }

  async signUpUserInCognito(phoneNumber: string, name: string, userId: string): Promise<void> {
    const signUpUserParams: SignUpCommandInput = {
      Username: phoneNumber,
      UserAttributes: [
        { Name: 'phone_number', Value: phoneNumber },
        { Name: 'name', Value: name },
        { Name: 'custom:userId', Value: userId }
      ],
      ValidationData: null,
      Password: generateRandomPassword(),
      ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID
    }
    const signUpUserCommand = new SignUpCommand(signUpUserParams);
    await this.cognitoClient.send(signUpUserCommand);
  }

  async signInUser(phoneNumber: string) {
    const userDetail = await this.dbService.users.findOne({ phoneNumber });
    if (userDetail) {
      const initResponse = await this.generateOtp(phoneNumber)
      return {
        message: 'OTP sent successfully',
        user: userDetail,
        challengeName: initResponse.ChallengeName,
        session: initResponse.Session,
      };
    } else {
      throw new BadRequestException('User does not exist');
    }
  }

  async generateOtp(phoneNumber: string) {
    try {
      const initParams = {
        AuthFlow: AuthFlowType.CUSTOM_AUTH,
        AuthParameters: {
          USERNAME: phoneNumber
        },
        ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID
      };
      const initAuthUserCommand = new InitiateAuthCommand(initParams);
      const initResponse = await this.cognitoClient.send(initAuthUserCommand);
      return initResponse
    } catch (err) {
      console.log(err);
      throw new ErrorException('Failed to generate OTP');
    }
  }

  // Verify OTP (Optimized for persistent OTP retry mechanism)
  async verifyOTP(verifyOtpDto: VerifyOtpDto) {
    const { phoneNumber, code, session } = verifyOtpDto;
    try {
      const command = new RespondToAuthChallengeCommand({
        ChallengeName: 'CUSTOM_CHALLENGE',
        ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
        ChallengeResponses: {
          USERNAME: phoneNumber,
          ANSWER: code,
        },
        Session: session,
      });

      const response = await this.cognitoClient.send(command);

      // Check if response contains a new challenge (retry scenario with same OTP)
      if (response.ChallengeName === 'CUSTOM_CHALLENGE' && response.Session) {
        // Lambda decided to allow retry with the same OTP
        throw new BadRequestException({
          message: 'Invalid OTP. Please try again with the same OTP code.',
          errorCode: 'INVALID_OTP_RETRY_SAME_CODE',
          newSession: response.Session,
          challengeName: response.ChallengeName,
          retryAllowed: true,
          persistentOTP: true
        });
      }

      // Successful authentication
      if (response.AuthenticationResult) {
        return {
          accessToken: response.AuthenticationResult.AccessToken,
          refreshToken: response.AuthenticationResult.RefreshToken,
          idToken: response.AuthenticationResult.IdToken,
          message: 'Login successful',
          user: await this.dbService.users.findOne({ phoneNumber })
        };
      }

      // Unexpected response
      throw new BadRequestException('Unexpected authentication response');

    } catch (error) {
      console.log('OTP Verification Error:', error);

      // Handle specific Cognito errors
      if (error.name === 'NotAuthorizedException') {
        if (error.message.includes('Incorrect username or password') ||
          error.message.includes('User authentication failed')) {
          throw new BadRequestException({
            message: 'Maximum OTP attempts exceeded. Please request a new OTP.',
            errorCode: 'MAX_OTP_ATTEMPTS_EXCEEDED'
          });
        }

        // Other authorization errors
        throw new BadRequestException({
          message: 'Authentication failed. Please generate a new OTP.',
          errorCode: 'AUTHENTICATION_FAILED'
        });
      }

      if (error.name === 'CodeMismatchException') {
        throw new BadRequestException({
          message: 'Invalid OTP code. Please try again with the same OTP.',
          errorCode: 'INVALID_OTP_CODE'
        });
      }

      // If it's already a BadRequestException (from our retry logic), re-throw it
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Generic error
      throw new BadRequestException('OTP verification failed');
    }
  }

  // Refresh Token
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
        AuthParameters: {
          'REFRESH_TOKEN': refreshTokenDto.refreshToken,
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

  // Sign Out
  async signOut(accessToken: string, refreshToken: string) {
    try {
      await this.cognitoClient.send(new RevokeTokenCommand({
        ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
        Token: refreshToken,
      }));
      try {
        await this.cognitoClient.send(new GlobalSignOutCommand({
          AccessToken: accessToken,
        }))
      } catch (err) {
        console.log(err.message);
      }
      return { message: 'Signed out successfully' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // Resend OTP
  async resendOTP(phoneNumber: string) {
    try {
      const command = new ResendConfirmationCodeCommand({
        ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID,
        Username: phoneNumber,
      });

      await this.cognitoClient.send(command);

      return {
        message: 'OTP resent successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // Get User Profile : Promise<IUser>
  async getUserProfile(accessToken: string) {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const response = await this.cognitoClient.send(command);

      const attributes = response.UserAttributes.reduce((acc, attr) => {
        acc[attr.Name] = attr.Value;
        return acc;
      }, {});

      return {
        id: response.Username,
        username: attributes['preferred_username'],
        phoneNumber: attributes['phone_number'],
        enabled: true,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async updateUserPhoneNumberInCognito(oldPhoneNumber: string, newPhoneNumber: string, userId: string) {
    try {
      const deleteUserCommand = new AdminDeleteUserCommand({
        UserPoolId: process.env.COGNITO_CUSTOMER_USER_POOL_ID,
        Username: oldPhoneNumber
      });

      try {
        await this.cognitoClient.send(deleteUserCommand);
        console.log(`Successfully deleted user ${oldPhoneNumber} from Cognito`);
      } catch (error) {
        if (error.name === 'UserNotFoundException') {
          console.warn(`User ${oldPhoneNumber} not found in Cognito, proceeding with creation`);
        } else {
          throw new Error(`Failed to delete user from Cognito: ${error.message}`);
        }
      }

      const signUpUserParams: SignUpCommandInput = {
        Username: newPhoneNumber,
        UserAttributes: [
          { Name: 'phone_number', Value: newPhoneNumber },
          { Name: 'custom:userId', Value: userId }
        ],
        ValidationData: null,
        Password: generateRandomPassword(),
        ClientId: process.env.COGNITO_CUSTOMER_APP_CLIENT_ID
      }
      const signUpUserCommand = new SignUpCommand(signUpUserParams);
      await this.cognitoClient.send(signUpUserCommand);

      return true;
    } catch (error) {
      console.warn('Failed to update phone number in Cognito', error);
      throw new Error('Failed to update phone number in Cognito');
    }
  }

  async generateJWTToken(user: IUsers) {
    try {
      const payload: Record<string, any> = {
        userId: user.userId,
        phoneNumber: user.phoneNumber,
        iat: Math.floor(Date.now() / 1000)
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
        user
      };
    } catch (error) {
      console.error('JWT Generation Error:', error);
      throw new ErrorException('Failed to generate JWT token');
    }
  }
}

