import { IsString, IsNotEmpty, IsOptional, IsEmail, IsArray, IsEnum, ArrayMinSize } from 'class-validator';
import { AdminRoles } from 'src/common/enums/user.enum';
import { IMetaTag } from '../entities/admin-user.entity';
 
export class MetaTagDto implements IMetaTag {
  @IsString()
  @IsNotEmpty({ message: 'Institution ID is required' })
  institutionId: string;
 
  @IsArray({ message: 'Departments ID must be an array' })
  @ArrayMinSize(1, { message: 'At least one department ID is required' })
  @IsString({ each: true, message: 'Each department ID must be a string' })
  @IsNotEmpty({ message: 'Departments ID is required' })
  departmentsId: string[];
}
 
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
 