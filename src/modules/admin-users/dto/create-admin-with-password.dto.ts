import { IsString, IsNotEmpty, IsOptional, IsEmail, IsArray, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminRoles } from 'src/common/enums/user.enum';

export class CreateAdminWithPasswordDto {
  @ApiProperty({
    description: 'Admin first name',
    example: 'John'
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @ApiProperty({
    description: 'Admin last name',
    example: 'Doe'
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @ApiProperty({
    description: 'Admin email address',
    example: 'admin@company.com'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'Unique username for admin',
    example: 'admin_user',
    minLength: 3,
    maxLength: 20
  })
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must be at most 20 characters long' })
  userName: string;

  @ApiProperty({
    description: 'Temporary password for admin (will be used for Cognito signup)',
    example: 'TempPass123!',
    minLength: 8
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    description: 'Admin phone number',
    example: '+1234567890',
    required: false
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    description: 'Admin role',
    enum: AdminRoles,
    example: AdminRoles.ADMIN,
    required: false
  })
  @IsEnum(AdminRoles, { message: 'Invalid admin role' })
  @IsOptional()
  role?: AdminRoles;

  @ApiProperty({
    description: 'Admin abilities and permissions',
    required: false,
    type: 'array',
    items: {
      type: 'object',
      properties: {
        attributeName: { type: 'string' },
        attributeAccess: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  @IsOptional()
  @IsArray()
  abilities?: {
    attributeName: string;
    attributeAccess: string[];
  }[];
}
