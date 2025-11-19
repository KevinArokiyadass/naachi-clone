import { PartialType } from '@nestjs/mapped-types';
import { AdminUserDto } from './create-admin-user.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateAdminUserDto extends PartialType(AdminUserDto) {
  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be either active or inactive' })
  status?: string;
} 