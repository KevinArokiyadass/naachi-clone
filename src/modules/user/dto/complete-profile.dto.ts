import { IsNotEmpty, IsPhoneNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteProfileDto {
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
    example: '+919876543210',
    description: 'User phone number in international format',
  })
  @IsPhoneNumber()
  phoneNumber: string;

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

  @ApiProperty({
    description: 'Profile image URL (optional)',
    example: 'https://example.com/profile-image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;
}
