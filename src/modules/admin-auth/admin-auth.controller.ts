import { Controller, Post, Body, UnauthorizedException, Headers, BadRequestException, HttpCode, HttpStatus, Req } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAuthService } from "./admin-auth.service";
import { AdminUserService } from "../admin-users/admin-user.service";
import { CognitoService } from "../cognito/cognito.service";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { ConfirmSignUpDto } from "./dto/confirm-signup.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AdminRoles } from "../../common/enums/user.enum";

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
  async login(@Body() loginDto: AdminLoginDto, @Req() req: Request) {
    try {
      const institutionsId = req['institutionsId'];
      const isSuperAdminRequest = req['isSuperAdminRequest'];
      
      if (!isSuperAdminRequest && !institutionsId) {
        throw new UnauthorizedException('Institution ID is required. Please provide Origin header.');
      }

      const admin = await this.adminUsers.getOneAdminUser({ email: loginDto.userName });
      if (!admin) {
        throw new UnauthorizedException('Admin not found');
      }

      if (admin.status === 'inactive') {
        throw new UnauthorizedException('Admin account is inactive');
      }

      if (isSuperAdminRequest) {
        const normalizedRole = String(admin.role).trim().toUpperCase();
        if (normalizedRole !== AdminRoles.SUPER_ADMIN) {
          throw new UnauthorizedException('Only SUPER_ADMIN can use this authentication method');
        }
      }

      const cognitoUsername = admin.userName || admin.email;
      const tokens = await this.cognito.signIn(cognitoUsername, loginDto.password);

      return {  
        message: 'Login successful', 
        adminUser: {
          adminId: admin.adminId,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, 
        tokens: {
          accessToken: tokens.accessToken,
          idToken: tokens.idToken,
          refreshToken: tokens.refreshToken
        },
        ...(institutionsId && { institutionsId })
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
    const tokens = await this.authService.refreshAccessToken(
      refreshDto.userName,
      refreshDto.refresh_token,
    );
    return {
      message: 'Token refreshed successfully',
      tokens,
    };
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
  
      await this.adminUsers.setPasswordByEmail(body.email, body.newPassword);
      return { message: 'Password reset successful', cognito: result };
    } catch (error) {
      throw new BadRequestException(`Password reset failed: ${error.message}`);
    }
  }
}