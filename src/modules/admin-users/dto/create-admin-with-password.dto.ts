import { IsString, IsNotEmpty, IsOptional, IsEmail, IsArray, IsEnum, MinLength, MaxLength, ValidateIf, ArrayMinSize, ValidateNested, IsDefined } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AdminRoles, IMetaTag } from 'src/common/enums/user.enum';

export class MetaTagDto implements IMetaTag {
  @IsString()
  @IsNotEmpty({ message: 'Institution ID is required' })
  institutionsId: string;

  @IsArray({ message: 'Departments ID must be an array' })
  @ArrayMinSize(1, { message: 'At least one department ID is required' })
  @IsString({ each: true, message: 'Each department ID must be a string' })
  @IsNotEmpty({ message: 'Departments ID is required' })
  departmentsId: string[];
}

function isSuperAdminOrAdmin(role: AdminRoles | string): boolean {
  return role === AdminRoles.SUPER_ADMIN || role === AdminRoles.ADMIN;
}

export class CreateAdminWithPasswordDto {
  @Transform(({ value, obj }) => {
    const v = typeof value === 'string' ? value.trim() : '';
    if (v) return v;
    const first = typeof obj?.firstName === 'string' ? obj.firstName.trim() : '';
    const last = typeof obj?.lastName === 'string' ? obj.lastName.trim() : '';
    return first && last ? `${first} ${last}` : value;
  })
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'Name is required. Provide either "name" or both "firstName" and "lastName".' })
  name: string;

  @IsOptional()
  @IsString({ message: 'firstName must be a string' })
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'lastName must be a string' })
  lastName?: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsOptional()
  @IsString({ message: 'userName must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must be at most 20 characters long' })
  userName?: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsEnum(AdminRoles, { message: 'Invalid admin role' })
  @IsNotEmpty({ message: 'Role is required' })
  role: AdminRoles;

  @ValidateIf((o) => o.role === AdminRoles.INSTITUTIONADMIN)
  @IsDefined({ message: 'MetaTags are required for INSTITUTION_ADMIN role' })
  @IsNotEmpty({ message: 'MetaTags are required for INSTITUTION_ADMIN role' })
  @IsArray({ message: 'MetaTags must be an array' })
  @ArrayMinSize(1, { message: 'At least one metaTag is required for INSTITUTION_ADMIN role' })
  @ValidateNested({ each: true })
  @Type(() => MetaTagDto)
  metaTags?: IMetaTag[];

  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be either active or inactive' })
  status?: string = 'active';

  @ValidateIf((o) => !isSuperAdminOrAdmin(o.role))
  @IsArray({ message: 'Permission groups ID must be an array' })
  @ArrayMinSize(1, { message: 'At least one permission group is required' })
  @IsString({ each: true, message: 'Each permission group ID must be a string' })
  @IsNotEmpty({ message: 'Permission groups ID is required' })
  permissionGroupsId?: string[];

  @IsString()
  @IsOptional()
  s3ProfileImageName?: string;
}
