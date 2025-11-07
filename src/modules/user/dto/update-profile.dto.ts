import { IsOptional, IsString, IsEmail, IsArray, IsPhoneNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserType } from 'src/common/interfaces/user.interface';

export class UpdateUserDto {
  @ApiProperty({
    description: 'First name of the user (optional)',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'Last name of the user (optional)',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'Email address of the user (optional)',
    example: 'john.doe@company.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  emailId?: string;

  @ApiProperty({
    description: 'Employee ID (optional)',
    example: 'EMP001',
    required: false,
  })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({
    description: 'Phone number of the user (optional)',
    example: '+919876543210',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Address of the user (optional)',
    example: '123 Main Street, City',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Division/Department of the user (optional)',
    example: 'Engineering',
    required: false,
  })
  @IsOptional()
  @IsString()
  divisionId?: string;

  @ApiProperty({
    description: 'User type classification (optional)',
    example: 'MEMBER',
    enum: UserType,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiProperty({
    description: 'Profile picture original filename (optional)',
    example: 'profile.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  profilePictureOriginalFileName?: string;

  @ApiProperty({
    description: 'Profile picture S3 filename (optional)',
    example: 'profile_12345.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  profilePictureS3FileName?: string;

  @ApiProperty({
    description: 'Profile image URL (optional)',
    example: 'https://example.com/profile-image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiProperty({
    description: 'Permission group IDs for the user (optional)',
    example: ['permissiongroup_123', 'permissiongroup_456'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionGroup?: string[];

  @ApiProperty({
    description: 'Location ID of the user (optional)',
    example: 'location_123',
    required: false,
  })
  @IsOptional()
  @IsString()
  locationId?: string;

}