import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { IAdminUser } from '../../common/interfaces/admin-user.interface';
import { IPaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationService } from '../../common/shared/pagination/pagination.service';
import { CognitoService } from '../cognito/cognito.service';
import { FilterQuery } from 'mongoose';
import { RecordService } from '@noukha-technologies/mdm-core';


@Injectable()
export class AdminUserService {
  constructor(
    private dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService,
    private readonly cognitoService: CognitoService,
    private readonly recordService: RecordService,
  ) { }

  async createAdminUser(createAdminDto: any) {
    const existingAdmin = await this.dbServices.adminUser.findOne({ email: createAdminDto.email });
    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    if (!createAdminDto.role) {
      throw new BadRequestException("Role is required");
    }

    const userName = createAdminDto.userName || createAdminDto.email.split('@')[0];

    const { password, ...adminDataWithoutPassword } = createAdminDto;
    const created = await this.dbServices.adminUser.create({
      ...adminDataWithoutPassword,
      userName: userName,
      password: password,
      status: createAdminDto.status ?? 'active',
    });


    try {
      await this.cognitoService.createAdminUser(
        userName,
        createAdminDto.email,
        password,
        createAdminDto.name,
        createAdminDto.phoneNumber
      );
      return {
        adminUser: created,
        message: 'Admin user created successfully and ready to login.',
        requiresVerification: false
      };
    } catch (cognitoError) {
      try {
        await this.dbServices.adminUser.findOneAndDelete({ adminId: created.adminId });
      } catch (_) { }
      throw new BadRequestException(`Failed to create admin user in Cognito: ${cognitoError.message}`);
    }
  }

  async findAllAdminUsers(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean
  ): Promise<IPaginatedResult<(IAdminUser & { permissions?: string[] })[]>> {
    filter.isDeleted = { $in: [null, false] };
    const users = await this.paginationService.findAndPaginate(this.dbServices.adminUser, {
      skip,
      limit,
      filter,
      nonPaginated
    });
    
  
    if (users.items && users.items.length > 0) {
      const enrichedUsers = await Promise.all(
        users.items.map(async (user: IAdminUser) => {
          const permissions = await this.fetchPermissionsForUser(user.permissionGroupsId);
          return {
            ...user,
            permissions
          } as IAdminUser & { permissions: string[] };
        })
      );
      return {
        ...users,
        items: enrichedUsers
      };
    }
    
    return users;
  }

  async getAdminUserById(adminId: string): Promise<IAdminUser & { permissions?: string[] }> {
    const adminUser = await this.dbServices.adminUser.findOne({ adminId });
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }
    
    const permissions = await this.fetchPermissionsForUser(adminUser.permissionGroupsId);
    return {
      ...adminUser,
      permissions
    };
  }


  async update(adminId: string, updateAdminUserDto: UpdateAdminUserDto) {
    try {
      const adminUser = await this.dbServices.adminUser.findOne({ adminId });
      if (!adminUser) {
        throw new NotFoundException(`AdminUser with adminId ${adminId} not found`);
      }

      return await this.dbServices.adminUser.findOneAndUpdate(
        { adminId },
        updateAdminUserDto,
        { new: true }
      );
    }
    catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update adminUser: ' + error.message);
    }
  }

  async updatePassword(adminId: string, updatePasswordDto: UpdatePasswordDto, forgotPassword: boolean): Promise<{ message: string }> {
    const adminUser = await this.dbServices.adminUser.findOne({ adminId });
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }


    try {
      if (forgotPassword) {
        await this.cognitoService.forgotPassword(adminUser.email);
        return { message: 'Password reset code sent to email' };
      } else {
        throw new BadRequestException('Password updates should be handled through Cognito directly');
      }
    } catch (error) {
      throw new BadRequestException(`Failed to update password: ${error.message}`);
    }
  }

  async deleteAdminUser(adminId: string) {
    const adminUser = await this.dbServices.adminUser.findOne({ adminId });
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }
    return await this.dbServices.adminUser.findOneAndUpdate({ adminId }, { isDeleted: true }, { new: true });
  }


  async updateStatus(adminId: string, status: 'active' | 'inactive') {
    const adminUser = await this.dbServices.adminUser.findOne({ adminId });
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }

    return await this.dbServices.adminUser.findOneAndUpdate(
      { adminId },
      { status },
      { new: true }
    );
  }

  async getOneAdminUser(
    filter: FilterQuery<IAdminUser>
  ) {
    return await this.dbServices.adminUser.findOne(filter);
  }

  async setPasswordByEmail(email: string, newPassword: string) {
    const admin = await this.dbServices.adminUser.findOne({ email });
    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }
    return await this.dbServices.adminUser.findOneAndUpdate(
      { email },
      { password: newPassword },
      { new: true }
    );
  }

  async updateRefreshToken(adminId: string, refreshToken: string) {
    return await this.dbServices.adminUser.findOneAndUpdate({ adminId }, { refreshToken: refreshToken }, { new: true });
  }


  private async fetchPermissionsForUser(permissionGroupIds: string[]): Promise<string[]> {
    if (!permissionGroupIds || permissionGroupIds.length === 0) {
      return [];
    }

    try {
      let permissionGroups: any[] = [];
      
      const permissionGroupPromises = permissionGroupIds.map(async (permissionGroupId) => {
        try {
          const result = await this.recordService.findAll('permissiongroups', {
            filters: {
              permissionGroupsId: permissionGroupId
            },
            nonPaginated: true
          });
          const items = result?.items || [];
          return items;
        } catch (error) {
          console.error(`Error fetching permission group ${permissionGroupId}:`, error);
          return [];
        }
      });
      
      const results = await Promise.all(permissionGroupPromises);
      permissionGroups = results.flat();
      
      const allPermissions: string[] = [];
      permissionGroups.forEach((group: any) => {
        if (group && group.permissionsId && Array.isArray(group.permissionsId)) {
          allPermissions.push(...group.permissionsId);
        } else {
          console.warn('Permission group missing permissionsId array:', group);
        }
      });

      const uniquePermissions = [...new Set(allPermissions)];
      return uniquePermissions;
    } catch (error) {
      console.error('Error fetching permissions for user:', error);
      return [];
    }
  }

}