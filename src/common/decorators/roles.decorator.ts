import { SetMetadata } from '@nestjs/common';
import { AdminRoles } from '../enums/user.enum';

export const Roles = (...roles: AdminRoles[]) => SetMetadata('roles', roles);

