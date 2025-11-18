import { IsNotEmpty, IsString, IsOptional, IsEmail, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ==================== SIGNUP FLOW ====================


 */
export class UsersSignupDto {
  @ApiProperty({
    description: 'Phone number (required)',
    example: '+919876543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;
}

/**
 * Verify Signup OTP DTO
 */
export class UsersVerifySignupDto {
  @ApiProperty({
    description: 'Phone number used during signup',
    example: '+919876543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    description: 'OTP sent to email and phone',
    example: '1234',
  })
  @IsNotEmpty({ message: 'OTP is required' })
  @IsString()
  otp: string;

  @ApiProperty({
    description: 'Cognito session returned from OTP initiation',
    example: 'AQoDYXdzEJr...'
  })
  @IsNotEmpty({ message: 'Session is required' })
  @IsString()
  session: string;
}

// ==================== LOGIN FLOW ====================

/**
 * Login DTO - Login with phone number only (triggers OTP)
 */
export class UsersLoginDto {
  @ApiProperty({
    description: 'Phone number (required)',
    example: '+919876543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;
}


export class UsersVerifyLoginDto {
  @ApiProperty({
    description: 'Phone number',
    example: '+919876543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    description: 'OTP sent to phone number',
    example: '1234',
  })
  @IsNotEmpty({ message: 'OTP is required' })
  @IsString()
  otp: string;

  @ApiProperty({
    description: 'Cognito session returned from OTP initiation',
    example: 'AQoDYXdzEJr...'
  })
  @IsNotEmpty({ message: 'Session is required' })
  @IsString()
  session: string;
}

export class UsersRefreshTokenDto {
  @ApiProperty({
    description: 'Cognito refresh token',
    example: 'eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIn0...'
  })
  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsString()
  refreshToken: string;
}

export class UsersLogoutDto {
  @ApiProperty({
    description: 'Current Cognito access token',
    example: 'eyJraWQiOiJLT0pqd3Z...'
  })
  @IsNotEmpty({ message: 'Access token is required' })
  @IsString()
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token to revoke',
    example: 'eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIn0...'
  })
  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsString()
  refreshToken: string;
}

export class UsersGenerateJwtDto {
  @ApiProperty({
    description: 'User ID to generate JWT for',
    example: 'USR_abc123'
  })
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString()
  userId: string;
}

export class UsersCheckAvailableUserNameDto {
  @ApiProperty({
    description: 'Username to check availability',
    example: 'john_doe',
  })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  userName: string;
}
