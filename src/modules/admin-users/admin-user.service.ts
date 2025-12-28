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
import { AwsStoreService } from '../aws-store/aws-store.service';
import { generateUniqueUserNameFromEmail } from 'src/common/utils/util';


@Injectable()
export class AdminUserService {
  constructor(
    private dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService,
    private readonly cognitoService: CognitoService,
    private readonly recordService: RecordService,
    private readonly awsStoreService: AwsStoreService,
  ) { }

  async createAdminUser(createAdminDto: any) {
    const existingAdmin = await this.dbServices.adminUser.findOne({ email: createAdminDto.email });
    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }
   // phone number duplicate check
    const phoneNumber = createAdminDto.phoneNumber?.trim();
    if (phoneNumber) {
      const existingPhone = await this.dbServices.adminUser.findOne({
        phoneNumber,
        isDeleted: { $ne: true },
      });
  
      if (existingPhone) {
        throw new BadRequestException(
          'Admin with this phone number already exists'
        );
      }
    }
    if (!createAdminDto.role) {
      throw new BadRequestException("Role is required");
    }

    const userName = createAdminDto.userName?.trim() || await generateUniqueUserNameFromEmail(createAdminDto.email, this.dbServices);

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
        adminUser: this.attachProfileImageUrl(created),
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
          const userWithPermissions = {
            ...user,
            permissions
          } as IAdminUser & { permissions: string[] };
          return this.attachProfileImageUrl(userWithPermissions);
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
    const userWithPermissions = {
      ...adminUser,
      permissions
    };
    return this.attachProfileImageUrl(userWithPermissions);
  }


  async update(adminId: string, updateAdminUserDto: UpdateAdminUserDto) {
    try {
      const adminUser = await this.dbServices.adminUser.findOne({ adminId, isDeleted: { $ne: true }});
      if (!adminUser) {
        throw new NotFoundException(`AdminUser with adminId ${adminId} not found`);
      }

      const updatePayload: Record<string, any> = { ...updateAdminUserDto };

   //EMAIL DUPLICATE VALIDATION
     const incomingEmail = updateAdminUserDto.email?.trim().toLowerCase();

    if ( incomingEmail && incomingEmail !== adminUser.email ) {
    const duplicateEmail = await this.dbServices.adminUser.findOne({
    email: incomingEmail,
    adminId: { $ne: adminId },
    isDeleted: { $ne: true },
    });

    if (duplicateEmail) {
    throw new BadRequestException(
      'Email already exists. Please use another email address.'
    );
    }

    updatePayload.email = incomingEmail;
  }

  // USERNAME DUPLICATE VALIDATION

    const incomingUserName = updateAdminUserDto.userName?.trim();
  
    if (
      incomingUserName &&
      incomingUserName !== adminUser.userName
    ) {
      const duplicateUserName = await this.dbServices.adminUser.findOne({
        userName: incomingUserName,
        adminId: { $ne: adminId }, // exclude current admin
        isDeleted: { $ne: true },
      });
  
      if (duplicateUserName) {
        throw new BadRequestException(
          'Username already exists. Please choose another username.'
        );
      }
  
      updatePayload.userName = incomingUserName;
    }
  
    
    //   PHONE NUMBER DUPLICATE VALIDATION
     
    const incomingPhoneNumber = updateAdminUserDto.phoneNumber?.trim();
  
    if (
      incomingPhoneNumber &&
      incomingPhoneNumber !== adminUser.phoneNumber
    ) {
      const duplicatePhone = await this.dbServices.adminUser.findOne({
        phoneNumber: incomingPhoneNumber,
        adminId: { $ne: adminId }, // exclude current admin
        isDeleted: { $ne: true },
      });
  
      if (duplicatePhone) {
        throw new BadRequestException(
          'Phone number already exists. Please use another phone number.'
        );
      }
  
      updatePayload.phoneNumber = incomingPhoneNumber;
    }
      
      // Transform s3FileName to s3ProfileImageName for storage
      if (updateAdminUserDto.s3FileName !== undefined) {
        updatePayload.s3ProfileImageName = updateAdminUserDto.s3FileName;
        delete updatePayload.s3FileName;
      }

      const updatedUser = await this.dbServices.adminUser.findOneAndUpdate(
        { adminId },
        updatePayload,
        { new: true }
      );

      return this.attachProfileImageUrl(updatedUser);
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

    const updatedUser = await this.dbServices.adminUser.findOneAndUpdate(
      { adminId },
      { status },
      { new: true }
    );
    return this.attachProfileImageUrl(updatedUser);
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
      // Fetch all permission groups in a single optimized query
      let permissionGroups: any[] = [];
      
      try {
        const permissionGroupsResult = await this.recordService.findAll('permissiongroups', {
          filters: {
            permissionGroupsId: { $in: permissionGroupIds },
            isDeleted: false
          },
          nonPaginated: true
        });
        permissionGroups = permissionGroupsResult?.items || [];
      } catch (error) {
        console.error('Error fetching permission groups:', error);
        return [];
      }
      
      const allPermissions: string[] = [];
      permissionGroups.forEach((group: any) => {
        if (group && group.permissionsId && Array.isArray(group.permissionsId)) {
          allPermissions.push(...group.permissionsId);
        } else {
          console.warn('Permission group missing permissionsId array:', group);
        }
      });

      const uniquePermissions = [...new Set(allPermissions)];
      
      // If no permissions found, return empty array
      if (uniquePermissions.length === 0) {
        return [];
      }

      // Fetch all permissions in a single optimized query
      try {
        const permissionsResult = await this.recordService.findAll('permissions', {
          filters: {
            permissionsId: { $in: uniquePermissions },
            isDeleted: false
          },
          nonPaginated: true
        });

        const permissions = permissionsResult?.items || [];
        
        const permissionCodes: string[] = [];
        permissions.forEach((permission: any) => {
          if (permission && permission.code) {
            permissionCodes.push(permission.code);
          } else {
            console.warn('Permission missing code field:', permission);
          }
        });

        return permissionCodes;
      } catch (error) {
        console.error('Error fetching permission codes:', error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching permissions for user:', error);
      return [];
    }
  }

  private attachProfileImageUrl(adminUser: any): any {
    if (!adminUser) return adminUser;
    
    const userObj = adminUser.toObject ? adminUser.toObject() : { ...adminUser };
    
    // Add s3ProfileImageUrl as a separate field with CloudFront URL
    // Keep s3ProfileImageName as the filename, add s3ProfileImageUrl with the full URL
    if (userObj.s3ProfileImageName) {
      userObj.s3ProfileImageUrl = this.awsStoreService.getCloudFrontUrl(userObj.s3ProfileImageName);
    }
    
    return userObj;
  }

}