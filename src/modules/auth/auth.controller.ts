import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminLoginDto, MemberLoginDto, MemberOtpVerifyDto, ForgotPasswordDto, ResetPasswordDto } from '../user/dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
  @ApiOperation({ 
    summary: 'Admin login with email/username and password',
    description: 'Login for admin users using email or employeeId with password'
  })
  @ApiResponse({
    status: 200, 
    description: 'Admin login successful with JWT token',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        accessToken: { type: 'string' },
        message: { type: 'string', example: 'Admin login successful' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account inactive' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return await this.authService.adminLogin(dto.identifier, dto.password, dto.fcmToken);
  }

  @Post('member/login')
  @ApiResponse({ status: 401, description: 'Email/phone number not registered or account inactive' })
  async memberLogin(@Body() dto: MemberLoginDto) {
    return await this.authService.memberLogin(dto.identifier);
  }

  @Post('member/verify-otp')
  @ApiOperation({ 
    summary: 'Verify OTP and complete member login',
    description: 'Verify the OTP sent to member\'s email or phone number and complete the login process. Default OTP is 1234.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'OTP verified and login successful',
    schema: {
      type: 'object',
      properties: {
        user: { type: 'object' },
        accessToken: { type: 'string' },
        message: { type: 'string', example: 'Member login successful' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async memberVerifyOtp(@Body() dto: MemberOtpVerifyDto) {
    return await this.authService.memberOtpVerify(dto.identifier, dto.otp, dto.fcmToken);
  }

  @Post('forgot-password')
  @ApiOperation({ 
    summary: 'Request password reset (Admin users only)',
    description: 'Send password reset email to admin users'
  })
  @ApiResponse({ status: 200, description: 'Password reset email sent if email exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return await this.authService.forgotPassword(dto.emailId);
  }

  @Post('reset-password')
  @ApiOperation({ 
    summary: 'Reset password using reset token (Admin users only)',
    description: 'Reset admin user password using the token received via email'
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return await this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
