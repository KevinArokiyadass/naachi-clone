import { Controller, Post, Body, UnauthorizedException, Headers, BadRequestException, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminAuthService } from "./admin-auth.service";
import { AdminUserService } from "../admin-users/admin-user.service";
import { CognitoService } from "../cognito/cognito.service";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { ConfirmSignUpDto } from "./dto/confirm-signup.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@ApiTags('Admin Authentication')
@Controller('admin-auth')
export class AdminAuthController {
  constructor(
    private authService: AdminAuthService,
    private adminUsers: AdminUserService,
    private cognito: CognitoService,
  ) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: AdminLoginDto) {
    try {
      // First verify admin exists in our database
      const admin = await this.adminUsers.getOneAdminUser({ userName: loginDto.userName });
      if (!admin) {
        throw new UnauthorizedException('Admin not found');
      }

      // Authenticate with Cognito
      const tokens = await this.cognito.signIn(loginDto.userName, loginDto.password);
      
      // Update refresh token in database
      if (tokens.refreshToken) {
        await this.adminUsers.updateRefreshToken(admin.adminId, tokens.refreshToken);
      }

      return { 
        message: 'Login successful', 
        adminUser: {
          adminId: admin.adminId,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role,
          abilities: admin.abilities
        }, 
        tokens: {
          accessToken: tokens.accessToken,
          idToken: tokens.idToken,
          refreshToken: tokens.refreshToken
        }
      };
    } catch (error) {
      if (error.name === 'NotAuthorizedException' || error.name === 'UserNotConfirmedException') {
        throw new UnauthorizedException('Invalid credentials or user not confirmed');
      }
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    // TODO: Implement Cognito refresh token flow
    throw new BadRequestException('Refresh token flow not yet implemented');
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout admin user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Headers('authorization') authHeader: string) {
    try {
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        // Use Cognito logout with token
        await this.cognito.logout({ accessToken: token });
      }
      return { message: 'Logged out successfully' };
    } catch (error) {
      // Even if logout fails, return success to client
      return { message: 'Logged out successfully' };
    }
  }

  @Post('confirm-signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm admin signup with verification code' })
  @ApiResponse({ status: 200, description: 'Signup confirmed successfully' })
  async confirmSignUp(@Body() confirmDto: ConfirmSignUpDto) {
    try {
      const result = await this.cognito.confirmSignUp(confirmDto.userName, confirmDto.password, confirmDto.code);
      
      // After successful confirmation, update admin status if needed
      const admin = await this.adminUsers.getOneAdminUser({ userName: confirmDto.userName });
      if (admin) {
        // Admin is now confirmed and can login
        return {
          message: 'Admin signup confirmed successfully',
          adminUser: {
            adminId: admin.adminId,
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
            role: admin.role
          },
          tokens: result.tokens
        };
      }
      
      return result;
    } catch (error) {
      throw new BadRequestException(`Confirmation failed: ${error.message}`);
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate forgot password flow' })
  @ApiResponse({ status: 200, description: 'Password reset code sent' })
  async forgotPassword(@Body() body: { email: string }) {
    try {
      // Verify admin exists
      const admin = await this.adminUsers.getOneAdminUser({ email: body.email });
      if (!admin) {
        throw new BadRequestException('Admin not found');
      }

      const result = await this.cognito.forgotPassword(body.email);
      return result;
    } catch (error) {
      throw new BadRequestException(`Failed to initiate password reset: ${error.message}`);
    }
  }

  @Post('confirm-forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm forgot password with code and new password' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  async confirmForgotPassword(@Body() body: { email: string; code: string; newPassword: string }) {
    try {
      const result = await this.cognito.confirmForgotPassword(body.email, body.code, body.newPassword);
      return result;
    } catch (error) {
      throw new BadRequestException(`Password reset failed: ${error.message}`);
    }
  }
}