import { IsEmail, IsNotEmpty, IsString, MinLength, IsPhoneNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Admin Login DTO - Login with email/username and password
export class AdminLoginDto {
  @ApiProperty({
    description: 'Email address or username of the admin user',
    example: 'admin@company.com',
  })
  @IsNotEmpty()
  @IsString()
  identifier: string; // Can be email or username

  @ApiProperty({
    description: 'Admin password',
    example: 'MySecurePassword123!',
  })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({
    description: 'FCM token',
    example: 'fcmToken',
  })
  @IsOptional() // need to make it required in production
  @IsString()
  fcmToken: string;
}

// Member Login DTO - Login with email or phone number (triggers OTP)
export class MemberLoginDto {
  @ApiProperty({
    description: 'Email address or phone number in international format',
    example: 'member@example.com or +919876543210',
  })
  @IsNotEmpty()
  @IsString()
  identifier: string; // Can be email or phone number
}

// Member OTP Verification DTO
export class MemberOtpVerifyDto {
  @ApiProperty({
    description: 'Email address or phone number in international format',
    example: 'member@example.com or +919876543210',
  })
  @IsNotEmpty()
  @IsString()
  identifier: string; // Can be email or phone number

  @ApiProperty({
    description: 'OTP sent to email or phone number (default: 1234)',
    example: '1234',
  })
  @IsNotEmpty()
  @IsString()
  otp: string;

  @ApiProperty({
    description: 'FCM token',
    example: 'fcmToken',
  })
  @IsNotEmpty()
  @IsString()
  fcmToken: string;
}

// Legacy Login DTO - kept for backward compatibility
export class LoginDto {
  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@company.com',
  })
  @IsEmail()
  emailId: string;

  @ApiProperty({
    description: 'User password',
    example: 'MySecurePassword123!',
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@company.com',
  })
  @IsEmail()
  emailId: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
  })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters)',
    example: 'MyNewSecurePassword123!',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'MyCurrentPassword123!',
  })
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters)',
    example: 'MyNewSecurePassword123!',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword: string;
}
