import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminUserService } from '../../modules/admin-users/admin-user.service';
import { AdminRoles } from '../enums/user.enum';


@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private adminUserService: AdminUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<AdminRoles[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const username = user.username || user.sub;
    const email = user.email;

    if (!username && !email) {
      throw new UnauthorizedException(
        'Unable to identify user from token. Token must contain either "username" or "email" field.'
      );
    }

    let adminUser;
    if (username) {
      adminUser = await this.adminUserService.getOneAdminUser({ userName: username });
      
      if (!adminUser && email) {
        adminUser = await this.adminUserService.getOneAdminUser({ email });
      }
    } else if (email) {

      adminUser = await this.adminUserService.getOneAdminUser({ email });
    }

    if (!adminUser) {
      throw new ForbiddenException('Admin user not found');
    }

    if (adminUser.status === 'inactive') {
      throw new ForbiddenException('Admin account is inactive');
    }


    const userRole = String(adminUser.role).trim().toUpperCase();
    const hasRole = requiredRoles.some(
      (role) => String(role).trim().toUpperCase() === userRole,
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role: ${requiredRoles.join(' or ')}, but user has role: ${userRole}`,
      );
    }

    // Skip domain validation for create route - only validate JWT token role
    // Check handler name to identify the create route
    const handler = context.getHandler();
    const handlerName = handler?.name || '';
    const isCreateRoute = handlerName === 'createAdminUser';
    
    if (!isCreateRoute) {
      this.validateDomainAccess(adminUser, userRole, request);
    }



    request.adminUser = adminUser;

    return true;
  }


  private validateDomainAccess(adminUser: any, userRole: string, request: any): void {
    const isSuperAdminRequest = request['isSuperAdminRequest'];
    const institutionsId = request['institutionsId'];

    if (userRole === AdminRoles.SUPER_ADMIN) {
      if (!isSuperAdminRequest) {
        throw new ForbiddenException(
          'SUPER_ADMIN can only access from super admin domain. Please use the correct origin header.',
        );
      }
    } else if (userRole === AdminRoles.INSTITUTIONADMIN) {
      if (!institutionsId) {
        throw new ForbiddenException(
          'Institution ID is required. Please provide a valid Origin header.',
        );
      }

      if (!adminUser.metaTags || !Array.isArray(adminUser.metaTags) || adminUser.metaTags.length === 0) {
        throw new ForbiddenException(
          'Access denied. No institutions assigned to this admin user.',
        );
      }

      const hasMatchingInstitution = adminUser.metaTags.some(
        (tag: any) => tag && tag.institutionsId && String(tag.institutionsId).trim() === String(institutionsId).trim(),
      );

      if (!hasMatchingInstitution) {
        throw new ForbiddenException(
          `Access denied. Institution ID "${institutionsId}" does not match your assigned institutions.`,
        );
      }
    }
  }
}

