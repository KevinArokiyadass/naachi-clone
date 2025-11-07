import { IsPhoneNumber, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PhoneLoginDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Phone number in international format',
  })
  @IsPhoneNumber()
  phoneNumber: string;
}

export class VerifyPhoneOtpDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Phone number in international format',
  })
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty({
    example: '1234',
    description: 'OTP sent to phone number (default: 1234)',
  })
  @IsNotEmpty()
  otp: string;
}

export class CompletePhoneProfileDto {
  @ApiProperty({
    example: '+919876543210',
    description: 'Phone number in international format',
  })
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty({
    example: 'John',
    description: 'First name of the user',
  })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name of the user (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: '123 Main Street, City',
    description: 'Address of the user (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: 'Engineering',
    description: 'Division/Department of the user (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  divisionId?: string;
}
