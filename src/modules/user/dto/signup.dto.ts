import { IsNotEmpty, IsPhoneNumber, IsOptional, IsString, IsEmail, IsArray, IsEnum, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserType } from 'src/common/interfaces/user.interface';

export class CreateUserDto {
  @ApiProperty({
    description: 'Password for admin users (required for ADMIN, optional for MEMBER)',
    example: 'MySecurePassword123!',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @ValidateIf((o) => o.userType === UserType.ADMIN || o.password !== undefined)
  password?: string;
  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@company.com',
  })
  @IsEmail()
  emailId: string;

  @ApiProperty({
    description: 'Employee ID (optional)',
    example: 'EMP001',
    required: false,
  })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({
    description: 'Phone number of the user in international format (required for MEMBER users)',
    example: '+919876543210',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber()
  @ValidateIf((o) => o.userType === UserType.MEMBER || o.phoneNumber !== undefined)
  phoneNumber?: string;

  @ApiProperty({
    description: 'First name of the user',
    example: 'John',
  })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name of the user (optional)',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

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
    description: 'Location of the user (optional)',
    example: 'Mumbai, India',
    required: false,
  })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiProperty({
    description: 'Profile image URL (optional)',
    example: 'https://example.com/profile-image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiProperty({
    description: 'User type classification',
    example: 'MEMBER',
    enum: UserType,
    required: true,
  })
  @IsNotEmpty()
  @IsEnum(UserType)
  userType: UserType;

  @ApiProperty({
    description: 'Permission group IDs for the user (optional)',
    example: ['permissiongroup_123', 'permissiongroup_456'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionGroup?: string[];
}

// Specific DTO for creating member users (phone number required, password optional)
export class CreateMemberDto {
  @ApiProperty({
    description: 'Phone number of the member user in international format (required)',
    example: '+919876543210',
  })
  @IsNotEmpty()
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty({
    description: 'First name of the user',
    example: 'John',
  })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Employee ID (optional)',
    example: 'EMP001',
    required: false,
  })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({
    description: 'Last name of the user (optional)',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

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
    description: 'Location of the user (optional)',
    example: 'Mumbai, India',
    required: false,
  })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiProperty({
    description: 'Email address of the user (optional)',
    example: 'john.doe@company.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  emailId?: string;

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
}

// Specific DTO for creating admin users (email and password required)
export class CreateAdminDto {
  @ApiProperty({
    description: 'Email address of the admin user (required)',
    example: 'admin@company.com',
  })
  @IsNotEmpty()
  @IsEmail()
  emailId: string;

  @ApiProperty({
    description: 'Password for admin user (required)',
    example: 'MySecurePassword123!',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    description: 'Employee ID (optional)',
    example: 'EMP001',
    required: false,
  })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({
    description: 'Phone number of the user in international format (optional)',
    example: '+919876543210',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiProperty({
    description: 'First name of the user',
    example: 'John',
  })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name of the user (optional)',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

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
    description: 'Location of the user (optional)',
    example: 'Mumbai, India',
    required: false,
  })
  @IsOptional()
  @IsString()
  locationId?: string;

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
}
