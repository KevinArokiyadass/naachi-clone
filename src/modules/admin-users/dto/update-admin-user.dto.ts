import { PartialType } from '@nestjs/mapped-types';
import { CreateAdminWithPasswordDto } from './create-admin-with-password.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateAdminUserDto extends PartialType(CreateAdminWithPasswordDto) {
  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be either active or inactive' })
  status?: string;
} 