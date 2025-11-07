import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  AuthFlowType,
  ResendConfirmationCodeCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
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

  async signUpUser(email: string, password: string) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      await this.client.send(
        new SignUpCommand({
          ClientId: this.clientId,
          Username: email,
          Password: password,
          SecretHash: secretHash,
          UserAttributes: [{ Name: 'email', Value: email }],
        }),
      );
      return { message: 'Signup successful, check your email for OTP' };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async confirmSignUp(email: string, password: string, code: string,) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      await this.client.send(
        new ConfirmSignUpCommand({
          ClientId: this.clientId,
          Username: email,
          ConfirmationCode: code,
          SecretHash: secretHash,
        }),
      );
    
      const tokens = await this.signIn(email, password);

      return {
        message: 'Email verified successfully, user logged in',
        tokens, // accessToken, refreshToken, idToken
      };
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

  async signIn(email: string, password: string) {
    try {
      const secretHash = generateSecretHash(email, this.clientId, this.clientSecret);

      const res = await this.client.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: this.clientId,
          AuthParameters: {
            USERNAME: email,
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
}
