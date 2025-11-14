import { PartialType } from '@nestjs/mapped-types';
import { AdminUserDto } from './create-admin-user.dto';

export class UpdateAdminUserDto extends PartialType(AdminUserDto) {} 