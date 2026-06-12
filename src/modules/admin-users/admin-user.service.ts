import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Workbook } from 'exceljs';
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
import { generateUniqueUserNameFromEmail, passwordsDiffer, passwordsMatch } from 'src/common/utils/util';
import { MetaTagDto } from './dto/create-admin-with-password.dto';
import { assertInstitutionUploadScope } from '../../common/utils/institution-scope.util';


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
    // Validate role is provided
    if (!createAdminDto.role) {
      throw new BadRequestException('Role is required');
    }

    const existingAdmin = await this.dbServices.adminUser.findOne({ email: createAdminDto.email });
    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    let isVerifiedAdmin = false;
    const providedInstitutionsId = createAdminDto.metaTags?.[0]?.institutionsId;

    // Only validate email domain for INSTITUTION_ADMIN role if skipDomainValidation is not true
    if (createAdminDto.role === 'INSTITUTION_ADMIN' && !(createAdminDto as any).skipDomainValidation) {
      if (!providedInstitutionsId) {
        throw new BadRequestException('Institution ID is required in metaTags for INSTITUTION_ADMIN role');
      }

      // Validate email domain and get institution ID
      const validatedInstitutionsId = await this.validateInstitute(createAdminDto.email);

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

    const userName = createAdminDto.userName?.trim() || await generateUniqueUserNameFromEmail(createAdminDto.email, this.dbServices);

    const isSuperAdminOrAdmin = createAdminDto.role === 'SUPER_ADMIN' || createAdminDto.role === 'ADMIN';
    const permissionGroupsId = isSuperAdminOrAdmin && (!createAdminDto.permissionGroupsId || createAdminDto.permissionGroupsId.length === 0)
      ? []
      : (createAdminDto.permissionGroupsId ?? []);

    const { password, ...adminDataWithoutPassword } = createAdminDto;
    const created = await this.dbServices.adminUser.create({
      ...adminDataWithoutPassword,
      userName: userName,
      password: password,
      permissionGroupsId,
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

      // App user with the same email as this admin should show the verified tick
      if (existingUser) {
        try {
          const updateData: Record<string, any> = {
            isVerified: true,
            updatedAt: new Date(),
          };
          if (providedInstitutionsId) {
            updateData.institutionsId = providedInstitutionsId;
          }

          await this.dbServices.users.findOneAndUpdate(
            { userId: existingUser.userId, isDeleted: false },
            { $set: updateData },
          );
        } catch (syncError) {
          console.error('Failed to sync verification to matching app user:', syncError);
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

  async createOnboardingAdminUser(createAdminDto: any) {
    // Validate role is provided
    const role = createAdminDto.role || 'INSTITUTION_ADMIN';
    if (!createAdminDto.email) {
      throw new BadRequestException('Email is required');
    }
    if (!createAdminDto.password) {
      throw new BadRequestException('Password is required');
    }

    // Upfront Password Policy Validation to meet standard AWS Cognito complexity constraints
    const pwd = createAdminDto.password;
    if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      throw new BadRequestException('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
    }

    if (!createAdminDto.name) {
      throw new BadRequestException('Name is required');
    }
    if (!createAdminDto.institutionName) {
      throw new BadRequestException('Institution Name is required');
    }
    if (!createAdminDto.institutionDomain) {
      throw new BadRequestException('Institution Domain is required');
    }

    // 1. Verify email format and domain match
    const emailStr = createAdminDto.email.trim().toLowerCase();
    const instDomainStr = createAdminDto.institutionDomain.trim().toLowerCase();
    const emailParts = emailStr.split('@');
    if (emailParts.length !== 2 || emailParts[1] !== instDomainStr) {
      throw new BadRequestException(`Admin email domain (@${emailParts[1] || ''}) must match the institution domain (${instDomainStr})`);
    }

    // 2. Verify admin email/phone non-existence
    const existingAdmin = await this.dbServices.adminUser.findOne({ email: emailStr });
    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    const phoneNumber = createAdminDto.contactNumber?.trim() || createAdminDto.phoneNumber?.trim();
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
      email: emailStr,
      isDeleted: false
    });

    // 3. Verify institution domain uniqueness via RecordService to prevent duplicate institution entries
    try {
      const existingInstRes = await this.recordService.findAll('institutions', {
        filters: {
          $or: [
            { institutionDomain: instDomainStr },
            { institutionDomain: `@${instDomainStr}` }
          ],
        },
        fields: ['institutionDomain', 'institutionsId'],
        nonPaginated: true,
      });
      if (existingInstRes?.items && existingInstRes.items.length > 0) {
        throw new BadRequestException(`Institution with domain '${instDomainStr}' already exists`);
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
    }

    // 4. Create the Institution Record via RecordService
    let createdInst: any;
    try {
      createdInst = await this.recordService.createRecord('institutions', {
        data: {
          institutionName: createAdminDto.institutionName,
          institutionDomain: createAdminDto.institutionDomain,
          adminDomain: createAdminDto.adminDomain || '',
          contactName: createAdminDto.contactName || createAdminDto.name,
          contactNumber: phoneNumber || '',
          s3ProfileImageName: createAdminDto.s3ProfileImageName || '',
          status: 'active',
          isActive: true
        }
      });
    } catch (err: any) {
      throw new BadRequestException(`Failed to create institution record: ${err.message || 'Unknown error'}`);
    }

    const institutionsId = createdInst?.institutionsId || createdInst?.data?.institutionsId || createdInst?._id;
    if (!institutionsId) {
      throw new BadRequestException('Failed to retrieve created institution ID');
    }

    const userName = createAdminDto.userName?.trim() || await generateUniqueUserNameFromEmail(emailStr, this.dbServices);

    // 5. Fetch all permissions to map to the new admin
    let allPermissionsId: string[] = [];
    try {
      const permissionsResult = await this.recordService.findAll('permissions', {
        filters: {
          isDeleted: false
        },
        nonPaginated: true
      });
      const permissions = permissionsResult?.items || [];
      allPermissionsId = permissions.map((p: any) => p.permissionsId).filter(Boolean);
    } catch (err) {
      console.error('Failed to fetch permissions for onboarding admin:', err);
    }

    // 6. Create a permission group with all permissions
    let newPermissionGroupsId: string | undefined;
    if (allPermissionsId.length > 0) {
      try {
        const createdGroup = await this.recordService.createRecord('permissionGroups', {
          data: {
            name: 'Master Admin Group',
            description: 'Automatically created group with all permissions for institution onboarding',
            permissionsId: allPermissionsId,
            institutionsId: institutionsId,
            status: 'active',
          }
        });
        newPermissionGroupsId = createdGroup?.permissionGroupsId || createdGroup?.data?.permissionGroupsId;
      } catch (err) {
        console.error('Failed to create permission group for onboarding admin:', err);
      }
    }

    const permissionGroupsId = newPermissionGroupsId ? [newPermissionGroupsId] : [];

    // Ensure metaTags structure is present without mandatory departmentsId
    const metaTags = [
      {
        institutionsId: institutionsId,
        departmentsId: []
      }
    ];

    const { password, ...adminDataWithoutPassword } = createAdminDto;
    
    // 7. Create admin user in database
    let createdAdminDb: any;
    try {
      createdAdminDb = await this.dbServices.adminUser.create({
        name: createAdminDto.name,
        email: emailStr,
        role,
        metaTags,
        userName: userName,
        password: password,
        phoneNumber: phoneNumber || undefined,
        permissionGroupsId,
        status: createAdminDto.status ?? 'active',
        isVerifiedAdmin: true,
      } as any);
    } catch (err: any) {
      // If database insertion fails, attempt rollback of created institution status to inactive/deleted
      try {
        await this.recordService.updateRecord('institutions', institutionsId, {
          data: { isDeleted: true, status: 'inactive', isActive: false }
        });
      } catch (_) {}
      throw new BadRequestException(`Failed to create admin database record: ${err.message}`);
    }

    // 8. Provision user in AWS Cognito
    try {
      await this.cognitoService.createAdminUser(
        userName,
        emailStr,
        password,
        createAdminDto.name,
        phoneNumber,
      );

      if (existingUser) {
        try {
          const updateData: Record<string, any> = {
            institutionsId: institutionsId,
            isVerified: true,
            updatedAt: new Date()
          };

          await this.dbServices.users.findOneAndUpdate(
            { userId: existingUser.userId, isDeleted: false },
            { $set: updateData }
          );
        } catch (syncError) {
          console.error('Failed to sync institutionId to existing user:', syncError);
        }
      }

      return {
        adminUser: this.attachProfileImageUrl(createdAdminDb),
        institutionsId,
        message: 'Onboarding institution, permission group, and admin user created successfully.',
        requiresVerification: false,
      };
    } catch (cognitoError: any) {
      // Rollback database user and institution record
      try {
        await this.dbServices.adminUser.findOneAndDelete({ adminId: createdAdminDb.adminId });
        await this.recordService.updateRecord('institutions', institutionsId, {
          data: { isDeleted: true, status: 'inactive', isActive: false }
        });
      } catch (_) {}
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
      const adminUser = await this.dbServices.adminUser.findOne({ adminId: { $eq: adminId }, isDeleted: { $ne: true } });
      if (!adminUser) {
        throw new NotFoundException(`AdminUser with adminId ${adminId} not found`);
      }

      const updatePayload: Record<string, any> = { ...updateAdminUserDto };

      const incomingEmail = updateAdminUserDto.email?.trim().toLowerCase();

      if (incomingEmail && incomingEmail !== adminUser.email) {
        const duplicateEmail = await this.dbServices.adminUser.findOne({
          email: { $eq: incomingEmail },
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
          userName: { $eq: incomingUserName },
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
          phoneNumber: { $eq: incomingPhoneNumber },
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
    const adminUser = await this.dbServices.adminUser.findOne({ adminId: { $eq: adminId } });
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

    if (passwordsMatch(currentPassword, newPassword)) {
      throw new BadRequestException('New password cannot be the same as the current password');
    }


    if (passwordsDiffer(adminUser.password, currentPassword)) {
      throw new BadRequestException('Invalid current password');
    }

    try {
      await this.cognitoService.updatePasswordAfterVerification(adminUser.email, newPassword);

      await this.dbServices.adminUser.findOneAndUpdate(
        { adminId: { $eq: adminId } },
        { password: newPassword },
        { new: true }
      );

      return { message: 'Password updated successfully' };
    } catch (error) {
      throw new BadRequestException(`Failed to update password: ${error.message}`);
    }
  }

  async deleteAdminUser(adminId: string) {
    const adminUser = await this.dbServices.adminUser.findOne({ adminId: { $eq: adminId } });
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }
    return await this.dbServices.adminUser.findOneAndUpdate({ adminId: { $eq: adminId } }, { isDeleted: true }, { new: true });
  }


  async updateStatus(adminId: string, status: 'active' | 'inactive') {
    const adminUser = await this.dbServices.adminUser.findOne({ adminId: { $eq: adminId } });
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }

    const updatedUser = await this.dbServices.adminUser.findOneAndUpdate(
      { adminId: { $eq: adminId } },
      { status },
      { new: true }
    );
    return this.attachProfileImageUrl(updatedUser);
  }

  async getOneAdminUser(
    filter: FilterQuery<IAdminUser>
  ) {
    // Sanitize filter to prevent NoSQL injection by wrapping plain values with $eq
    const sanitizedFilter: FilterQuery<IAdminUser> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
        // If value is already an operator object (e.g., { $regex: ... }), keep it as is
        sanitizedFilter[key] = value;
      } else {
        // Wrap plain values with $eq to prevent injection
        sanitizedFilter[key] = { $eq: value };
      }
    }
    return await this.dbServices.adminUser.findOne(sanitizedFilter);
  }

  async getMobileAppUserByEmail(email: string) {
    if (!email) return null;
    return await this.dbServices.users.findOne({
      email: { $eq: String(email).toLowerCase().trim() },
      isDeleted: false
    });
  }

  async setPasswordByEmail(email: string, newPassword: string) {
    const admin = await this.dbServices.adminUser.findOne({ email: { $eq: email } });
    if (!admin) {
      throw new NotFoundException('Admin user not found');
    }

    if (passwordsMatch(admin.password, newPassword)) {
      throw new BadRequestException('New password cannot be the same as the current password');
    }

    return await this.dbServices.adminUser.findOneAndUpdate(
      { email: { $eq: email } },
      { password: newPassword },
      { new: true }
    );
  }

  async updateRefreshToken(adminId: string, refreshToken: string) {
    const updated = await this.dbServices.adminUser.findOneAndUpdate({ adminId: { $eq: adminId } }, { refreshToken: refreshToken }, { new: true });
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

  async getBulkUploadTemplate(): Promise<{ fileName: string; fileBuffer: Buffer }> {
    const fileName = 'admin-user-bulk-upload-template-v2.xlsx';
    const filePath = path.resolve(process.cwd(), 'templates', fileName);

    try {
      const fileBuffer = await fs.readFile(filePath);
      return { fileName, fileBuffer };
    } catch (_) {
      throw new NotFoundException('Bulk upload template not found');
    }
  }

  validateInstitutionScope(
    institutionsId: string,
    requestContext: { institutionsId?: string; isSuperAdminRequest?: boolean },
  ): void {
    assertInstitutionUploadScope(institutionsId, requestContext);
  }

  async getBulkUploadOptions(institutionsId: string): Promise<{
    institutionsId: string;
    permissions: Array<{ name: string; permissionGroupsId: string }>;
    departments: Array<{ departmentName: string; departmentsId: string }>;
  }> {
    const [permissionsResult, departmentsResult] = await Promise.all([
      this.recordService.findAll('permissiongroups', {
        filters: {
          institutionsId,
          isDeleted: false,
          isActive: true,
        },
        fields: ['name', 'permissionGroupsId'],
        nonPaginated: true,
      }),
      this.recordService.findAll('departments', {
        filters: {
          institutionsId,
          isDeleted: false,
          isActive: true,
        },
        fields: ['departmentName', 'departmentsId'],
        nonPaginated: true,
      }),
    ]);

    return {
      institutionsId,
      permissions: (permissionsResult?.items || []).map((item: any) => ({
        name: item.name,
        permissionGroupsId: item.permissionGroupsId,
      })),
      departments: (departmentsResult?.items || []).map((item: any) => ({
        departmentName: item.departmentName,
        departmentsId: item.departmentsId,
      })),
    };
  }

  async getInstitutionBulkUploadTemplate(institutionsId: string): Promise<{ fileName: string; fileBuffer: Buffer }> {
    const options = await this.getBulkUploadOptions(institutionsId);
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('BulkUpload');
    const master = workbook.addWorksheet('MasterData');

    const headers = [
      'Name',
      'phoneNumber',
      'email id',
      'select permission',
      'select department',
      'create password',
      'confirm password',
    ];

    sheet.addRow(headers);
    sheet.addRow([
      'John Admin',
      '+447912345678',
      'john.admin@example.com',
      options.permissions[0]?.name || '',
      options.departments[0]?.departmentName || '',
      'Password@123',
      'Password@123',
    ]);

    sheet.columns = [
      { width: 24 },
      { width: 25, style: { numFmt: '@' } },
      { width: 34 },
      { width: 28 },
      { width: 28 },
      { width: 22 },
      { width: 22 },
    ];
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    master.getCell('A1').value = 'PermissionName';
    master.getCell('B1').value = 'DepartmentName';
    options.permissions.forEach((permission, index) => {
      master.getCell(`A${index + 2}`).value = permission.name;
    });
    options.departments.forEach((department, index) => {
      master.getCell(`B${index + 2}`).value = department.departmentName;
    });
    master.state = 'veryHidden';

    const maxValidatedRows = 100;
    for (let row = 2; row <= maxValidatedRows; row++) {
      sheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['MasterData!$A$2:$A$500'],
      };
      sheet.getCell(`E${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['MasterData!$B$2:$B$500'],
      };
    }

    const notes = workbook.addWorksheet('Notes');
    notes.addRows([
      ['Rule', 'Details'],
      ['Institution', `Template generated for institutionsId: ${institutionsId}`],
      ['Phone format', 'Phone numbers must start with the + country code prefix'],
      ['Email', 'Use lowercase email with @'],
      ['Password', 'Minimum 8 chars, include uppercase + number + special character'],
      ['Confirm password', 'Must match create password'],
    ]);
    notes.columns = [{ width: 20 }, { width: 90 }];

    const fileName = `admin-user-bulk-upload-template-${institutionsId}.xlsx`;
    const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { fileName, fileBuffer };
  }
}