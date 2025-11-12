import { IsNotEmpty, IsString, IsOptional, IsEmail, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class VerifyPhoneDto {
  @ApiProperty({
    description: 'Phone number to verify',
    example: '+919876543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;
}

export class ConfirmPhoneDto {
  @ApiProperty({
    description: 'Phone number that received the OTP',
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
}

export class SetUsernameDto {
  @ApiProperty({
    description: 'Phone number from previous step',
    example: '+919876543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

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
}

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Phone number from previous step',
    example: '+919876543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    description: 'Email address to verify',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}

export class ConfirmEmailDto {
  @ApiProperty({
    description: 'Email address that received the OTP',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    description: 'OTP sent to email',
    example: '5678',
  })
  @IsNotEmpty({ message: 'OTP is required' })
  @IsString()
  otp: string;
}

export class CompleteSignupDto {
  @ApiProperty({
    description: 'Phone number from signup process',
    example: '+919876543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    description: 'Full name (optional)',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  Name?: string;

  @ApiProperty({
    description: 'FCM token (optional)',
    example: 'fcm-token-here',
    required: false,
  })
  @IsOptional()
  @IsString()
  fcmToken?: string;
}
