import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  AuthFlowType,
  ResendConfirmationCodeCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminSetUserPasswordCommand,
  RevokeTokenCommand,
  GlobalSignOutCommand,
  AdminCreateUserCommand,
  DeliveryMediumType,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { Injectable, BadRequestException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { generateSecretHash } from 'src/common/utils/util';
import { IUser } from 'src/common/interfaces/user.interface';

@Injectable()
export class CognitoService {
  private client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  private clientId = process.env.COGNITO_CLIENT_ID!;
  private clientSecret = process.env.COGNITO_CLIENT_SECRET!;
  private userPoolId = process.env.COGNITO_USER_POOL_ID!;

  async createAdminUser(userName: string, email: string, password: string, firstName?: string, lastName?: string, phoneNumber?: string) {
    try {
      const userAttributes = [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' }
      ];

      // Add required name attributes if provided
      if (firstName) {
        userAttributes.push({ Name: 'given_name', Value: firstName });
      }
      if (lastName) {
        userAttributes.push({ Name: 'family_name', Value: lastName });
      }
      if (phoneNumber) {
        userAttributes.push({ Name: 'phone_number', Value: phoneNumber });
        userAttributes.push({ Name: 'phone_number_verified', Value: 'true' });
      }

      await this.client.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: userName,
          UserAttributes: userAttributes,
          TemporaryPassword: password,
          MessageAction: MessageActionType.SUPPRESS, // Don't send welcome email
          ForceAliasCreation: false,
        }),
      );

      // Set permanent password immediately
      await this.client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: userName,
          Password: password,
          Permanent: true,
        }),
      );

      return { message: 'Admin user created successfully and ready to login' };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async resendVerificationCode(email: string) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      const response = await this.client.send(
        new ResendConfirmationCodeCommand({
          ClientId: this.clientId,
          Username: email,
          SecretHash: secretHash,
        }),
      );

      return {
        message: 'Verification code resent successfully',
        destination: response.CodeDeliveryDetails?.Destination,
        deliveryMedium: response.CodeDeliveryDetails?.DeliveryMedium,
      };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async signIn(userName: string, password: string) {
    try {
      const secretHash = generateSecretHash(userName, this.clientId, this.clientSecret);

      const res = await this.client.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: this.clientId,
          AuthParameters: {
            USERNAME: userName,
            PASSWORD: password,
            SECRET_HASH: secretHash,
          },
        }),
      );
      return {
        accessToken: res.AuthenticationResult.AccessToken,
        refreshToken: res.AuthenticationResult.RefreshToken,
        idToken: res.AuthenticationResult.IdToken,
      };
    } catch (err) {
      console.log('<<<<<<< signIn >>>>>>>>> ')
      // Preserve the original error name for proper handling upstream
      err.name = err.name || 'UnknownError';
      throw err;
    }
  }

  async updateUserPassword(email: string, newPassword: string) {
    try {
      // First, check if user exists in Cognito using admin operations
      let userExists = false;
      let userStatus = null;
      
      try {
        const getUserResponse = await this.client.send(
          new AdminGetUserCommand({
            UserPoolId: this.userPoolId,
            Username: email,
          })
        );
        
        userExists = true;
        userStatus = getUserResponse.UserStatus;
        console.log(`User ${email} exists in Cognito with status: ${userStatus}`);
        
        // If user is unconfirmed, we can delete and recreate
        if (userStatus === 'UNCONFIRMED') {
          console.log(`Deleting unconfirmed user ${email} to recreate with new password`);
          
          // Delete the existing unconfirmed user
          await this.client.send(
            new AdminDeleteUserCommand({
              UserPoolId: this.userPoolId,
              Username: email,
            })
          );
          
          console.log(`Successfully deleted unconfirmed user ${email}`);
        } else {
          // User is confirmed, we shouldn't delete them
          console.log(`User ${email} is confirmed, cannot update password during signup`);
          throw new BadRequestException(`User is already verified. Use password reset flow instead.`);
        }
      } catch (getUserErr) {
        if (getUserErr.name === 'UserNotFoundException') {
          console.log(`User ${email} doesn't exist in Cognito, can create new one`);
          userExists = false;
        } else {
          console.log(`Error checking user ${email}:`, getUserErr.message);
          throw getUserErr;
        }
      }
      
      // Now create the user with new password
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);
      
      await this.client.send(
        new SignUpCommand({
          ClientId: this.clientId,
          Username: email,
          Password: newPassword,
          SecretHash: secretHash,
          UserAttributes: [{ Name: 'email', Value: email }],
        }),
      );
      
      console.log(`Successfully created user ${email} with new password`);
      
      return { 
        message: 'Password updated and verification code sent successfully',
        action: 'password_updated_and_verification_sent',
        userWasRecreated: userExists
      };
    } catch (err) {
      console.log('Error in updateUserPassword:', err.message);
      
      // If we still get UsernameExistsException, something went wrong with deletion
      if (err.name === 'UsernameExistsException') {
        console.log(`User ${email} still exists after deletion attempt, trying resend code`);
        await this.resendVerificationCode(email);
        return { 
          message: 'Unable to update password, but verification code has been resent. Use your previous password for verification.',
          action: 'verification_code_resent_with_old_password',
          note: 'Password update failed, use previous password for verification'
        };
      }
      
      throw err;
    }
  }

  async forgotPassword(email: string) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      const response = await this.client.send(
        new ForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
          SecretHash: secretHash,
        }),
      );

      return {
        message: 'Password reset code sent successfully',
        destination: response.CodeDeliveryDetails?.Destination,
        deliveryMedium: response.CodeDeliveryDetails?.DeliveryMedium,
      };
    } catch (err) {
      console.log('Error in forgotPassword:', err.message);
      throw new BadRequestException(err.message);
    }
  }

  async confirmForgotPassword(email: string, confirmationCode: string, newPassword: string) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      await this.client.send(
        new ConfirmForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
          ConfirmationCode: confirmationCode,
          Password: newPassword,
          SecretHash: secretHash,
        }),
      );

      return {
        message: 'Password reset successful',
      };
    } catch (err) {
      console.log('Error in confirmForgotPassword:', err.message);
      throw new BadRequestException(err.message);
    }
  }

  async verifyConfirmationCode(email: string, confirmationCode: string) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      // We'll use a temporary password to verify the code, then immediately reset it
      const tempPassword = 'TempPass123!';
      
      await this.client.send(
        new ConfirmForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
          ConfirmationCode: confirmationCode,
          Password: tempPassword,
          SecretHash: secretHash,
        }),
      );

      return {
        message: 'Confirmation code verified successfully',
        verified: true,
      };
    } catch (err) {
      console.log('Error in verifyConfirmationCode:', err.message);
      throw new BadRequestException(err.message);
    }
  }

  async updatePasswordAfterVerification(email: string, newPassword: string) {
    try {
      // Since the confirmation code was already verified, we can directly update the password
      // We'll use the admin set user password command
      await this.client.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: this.userPoolId,
          Username: email,
          Password: newPassword,
          Permanent: true,
        }),
      );

      return {
        message: 'Password updated successfully',
      };
    } catch (err) {
      console.log('Error in updatePasswordAfterVerification:', err.message);
      throw new BadRequestException(err.message);
    }
  }
  
  async logout(options: { accessToken?: string; refreshToken?: string }) {
    const { accessToken, refreshToken } = options || {};
    try {
      // Prefer revoking the specific refresh token if provided
      if (refreshToken) {
        try {
          await this.client.send(
            new RevokeTokenCommand({
              ClientId: this.clientId,
              ClientSecret: this.clientSecret,
              Token: refreshToken,
            }),
          );
        } catch (rtErr) {
          // If refresh token is invalid/expired/already revoked, treat as non-fatal
          const msg = rtErr?.message || '';
          const name = rtErr?.name || '';
          const nonFatal =
            name === 'InvalidParameterException' ||
            name === 'InvalidRequestException' ||
            name === 'NotAuthorizedException' ||
            msg.includes('invalid') ||
            msg.includes('expired') ||
            msg.includes('revoked');
          if (!nonFatal) throw rtErr;
        }
      }

      // Additionally, if access token is provided, perform a global sign-out
      if (accessToken) {
        try {
          await this.client.send(
            new GlobalSignOutCommand({
              AccessToken: accessToken,
            }),
          );
        } catch (atErr) {
          // If access token is invalid/revoked/expired, treat as non-fatal
          const msg = atErr?.message || '';
          const name = atErr?.name || '';
          const nonFatal =
            name === 'NotAuthorizedException' ||
            msg.includes('Access Token has been revoked') ||
            msg.includes('Invalid Access Token') ||
            msg.includes('expired');
          if (!nonFatal) throw atErr;
        }
      }

      return { message: 'Logout successful' };
    } catch (err) {
      console.log('Error in logout:', err.message);
      throw new BadRequestException(err.message);
    }
  }
}
