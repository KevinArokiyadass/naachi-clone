import { IsString, IsNotEmpty, IsOptional, IsEmail, IsArray, IsEnum } from 'class-validator';
import { AdminRoles } from 'src/common/enums/user.enum';

export class AdminUserDto {
  @IsString()
  @IsOptional() 
  adminId?: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  lastName: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsEnum(AdminRoles, { message: 'Invalid admin role' })
  @IsOptional()
  role?: AdminRoles;

  @IsOptional()
  @IsArray()
  abilities?: {
    attributeName: string;
    attributeAccess: string[];
  }[];

  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be either active or inactive' })
  status?: string = 'active';
}