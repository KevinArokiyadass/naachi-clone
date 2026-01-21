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
import { MetaTagDto } from './dto/create-admin-with-password.dto';


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

    let isVerifiedAdmin = false;

    // Validate email domain and get institution ID
    const validatedInstitutionsId = await this.validateInstitute(createAdminDto.email);

    const providedInstitutionsId = createAdminDto.metaTags?.[0]?.institutionsId;

    if (createAdminDto.role === 'INSTITUTION_ADMIN') {
      if (!providedInstitutionsId) {
        throw new BadRequestException('Institution ID is required in metaTags for INSTITUTION_ADMIN role');
      }

      if (providedInstitutionsId !== validatedInstitutionsId) {
        throw new BadRequestException({
          message: `Email domain does not match with the provided institution ID.`,
          errorCode: 'INSTITUTION_MISMATCH',
        });
      }
    }

    if (providedInstitutionsId) {
      const institution = await this.recordService.findOne('institutions', providedInstitutionsId);
      if (!institution) {
        throw new BadRequestException('Institution not found');
      }
      isVerifiedAdmin = true;
    }

    const phoneNumber = createAdminDto.phoneNumber?.trim();
    if (phoneNumber) {
      const existingPhone = await this.dbServices.adminUser.findOne({
        phoneNumber,
        isDeleted: { $ne: true },
      });

      if (existingPhone) {
        throw new BadRequestException('Admin with this phone number already exists');
      }
    }

    // Check if there's an existing user with the same email
    const existingUser = await this.dbServices.users.findOne({
      email: createAdminDto.email.toLowerCase().trim(),
      isDeleted: false
    });

    if (!createAdminDto.role) {
      throw new BadRequestException('Role is required');
    }

    const userName = createAdminDto.userName?.trim() || await generateUniqueUserNameFromEmail(createAdminDto.email, this.dbServices);

    const { password, ...adminDataWithoutPassword } = createAdminDto;
    const created = await this.dbServices.adminUser.create({
      ...adminDataWithoutPassword,
      userName: userName,
      password: password,
      status: createAdminDto.status ?? 'active',
      isVerifiedAdmin,
    });


    try {
      await this.cognitoService.createAdminUser(
        userName,
        createAdminDto.email,
        password,
        createAdminDto.name,
        createAdminDto.phoneNumber,
      );

      // Sync institutionId to existing user if email matches and mark as verified
      // Set isVerified to true if institutionId exists (phone number check removed - phone numbers can differ)
      if (existingUser && institutionsId) {
        try {
          const updateData: Record<string, any> = {
            institutionsId: institutionsId,
            isVerified: true, // Set isVerified based on email match only, phone numbers can differ
            updatedAt: new Date()
          };

          await this.dbServices.users.findOneAndUpdate(
            { userId: existingUser.userId, isDeleted: false },
            {
              $set: updateData
            }
          );
        } catch (syncError) {
          // Log error but don't fail admin creation
          console.error('Failed to sync institutionId to existing user:', syncError);
        }
      }

      return {
        adminUser: this.attachProfileImageUrl(created),
        message: 'Admin user created successfully and ready to login.',
        requiresVerification: false,
      };
    } catch (cognitoError) {
      try {
        await this.dbServices.adminUser.findOneAndDelete({ adminId: created.adminId });
      } catch (_) {
        // Ignore deletion errors during rollback
      }
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
      const adminUser = await this.dbServices.adminUser.findOne({ adminId, isDeleted: { $ne: true } });
      if (!adminUser) {
        throw new NotFoundException(`AdminUser with adminId ${adminId} not found`);
      }

      const updatePayload: Record<string, any> = { ...updateAdminUserDto };

      const incomingEmail = updateAdminUserDto.email?.trim().toLowerCase();

      if (incomingEmail && incomingEmail !== adminUser.email) {
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

    if (forgotPassword) {
      try {
        await this.cognitoService.forgotPassword(adminUser.email);
        return { message: 'Password reset code sent to email' };
      } catch (error) {
        throw new BadRequestException(`Failed to initiate forgot password: ${error.message}`);
      }
    }

    const { currentPassword, newPassword } = updatePasswordDto;

    if (!currentPassword) {
      throw new BadRequestException('Current password is required for password update');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password cannot be the same as the current password');
    }


    if (adminUser.password !== currentPassword) {
      throw new BadRequestException('Invalid current password');
    }

    try {
      await this.cognitoService.updatePasswordAfterVerification(adminUser.email, newPassword);

      await this.dbServices.adminUser.findOneAndUpdate(
        { adminId },
        { password: newPassword },
        { new: true }
      );

      return { message: 'Password updated successfully' };
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

    if (admin.password === newPassword) {
      throw new BadRequestException('New password cannot be the same as the current password');
    }

    return await this.dbServices.adminUser.findOneAndUpdate(
      { email },
      { password: newPassword },
      { new: true }
    );
  }

  async updateRefreshToken(adminId: string, refreshToken: string) {
    const updated = await this.dbServices.adminUser.findOneAndUpdate({ adminId }, { refreshToken: refreshToken }, { new: true });
    return this.attachProfileImageUrl(updated);
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
            isDeleted: false,
            status: 'active'
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

    // Delete password if present to ensure it's not leaked in responses
    delete userObj.password;

    return userObj;
  }

  async validateInstitute(email: string): Promise<string> {
    const atIndex = email?.lastIndexOf('@') ?? -1;
    if (atIndex === -1 || atIndex === email.length - 1) {
      throw new BadRequestException('Invalid email format');
    }

    // Ensure email starts with an alphabet
    if (!/^[a-zA-Z]/.test(email)) {
      throw new BadRequestException({
        message: 'Email must start with an alphabet character.',
        errorCode: 'INVALID_EMAIL_START',
      });
    }

    const domain = email.substring(atIndex + 1).trim().replace(/^@/, '').toLowerCase();

    try {
      // Search for domain with or without @ prefix to handle both cases in database
      const response = await this.recordService.findAll('institutions', {
        filters: {
          $or: [
            { institutionDomain: domain },
            { institutionDomain: `@${domain}` }
          ],
        },
        fields: ['institutionDomain', 'institutionsId'],
        nonPaginated: true,
      });

      const hasMatch = Array.isArray(response?.items) && response.items.length > 0;

      if (!hasMatch) {
        throw new BadRequestException({
          message: `Email domain "${domain}" is not a registered domain.`,
          errorCode: 'INVALID_EMAIL_DOMAIN',
        });
      }

      const matchingInstitution = response.items[0];
      if (!matchingInstitution?.institutionsId) {
        throw new BadRequestException({
          message: 'Institution ID not found for the matching domain.',
          errorCode: 'INSTITUTION_ID_MISSING',
        });
      }

      return matchingInstitution.institutionsId;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException({
        message: 'Failed to validate email domain. Please try again.',
        errorCode: 'DOMAIN_VALIDATION_ERROR',
      });
    }
  }

}