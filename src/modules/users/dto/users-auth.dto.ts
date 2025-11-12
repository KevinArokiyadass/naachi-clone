import { IsNotEmpty, IsString, IsOptional, IsEmail, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ==================== SIGNUP FLOW ====================

/**
 * Signup DTO - User registration with OTP verification
 */
export class UsersSignupDto {
  @ApiProperty({
    description: 'Phone number (required)',
    example: '+919876543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    description: 'Email address (required)',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    description: 'Username (1-30 characters, letters, numbers, dots, underscores)',
    example: 'john_doe',
  })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  @Matches(/^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/, {
    message: 'Username must be 1-30 characters long, contain only letters, numbers, dots, and underscores. Cannot start or end with a dot, and cannot have consecutive dots.'
  })
  userName: string;

  @ApiProperty({
    description: 'Full name (optional)',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  Name?: string;
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
    description: 'FCM token (optional)',
    example: 'fcmToken',
    required: false,
  })
  @IsOptional()
  @IsString()
  fcmToken?: string;
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
    description: 'FCM token (optional)',
    example: 'fcmToken',
    required: false,
  })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}

