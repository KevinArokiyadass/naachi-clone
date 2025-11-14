import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { AdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { IAdminUser } from 'src/common/interfaces/admin-user.interface';
import { PaginationService } from '../../common/shared/pagination/pagination.service';
import { HttpClientService } from '../../common/inter-service-communication/http-client.service';
import { AttributeAccess, AttributeNames, AdminRoles } from '../../common/enums/user.enum';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { FilterQuery } from 'mongoose';
import { CognitoService } from '../cognito/cognito.service';

@Injectable()
export class AdminUserService {
  constructor(
    private dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService,
    private readonly httpClientService: HttpClientService,
    private readonly cognitoService: CognitoService,
  ) { }

  async createAdminUser(createAdminDto: AdminUserDto) {
    const existingAdmin = await this.dbServices.adminUser.findOne({ email: createAdminDto.email });
    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    // Set default role if not provided
    if (!createAdminDto.role) {
      createAdminDto.role = AdminRoles.ADMIN;
    }

    // Set default abilities based on role
    if (!createAdminDto.abilities) {
      createAdminDto.abilities = this.getDefaultAbilitiesForRole(createAdminDto.role);
    }

    // Create the admin in our DB (without password)
    const created = await this.dbServices.adminUser.create({
      ...createAdminDto,
      abilities: createAdminDto.abilities,
    });

    return created;
  }

  async createAdminUserWithPassword(createAdminDto: any) {
    const existingAdmin = await this.dbServices.adminUser.findOne({ email: createAdminDto.email });
    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    // Set default role if not provided
    if (!createAdminDto.role) {
      createAdminDto.role = AdminRoles.ADMIN;
    }

    // Set default abilities based on role
    if (!createAdminDto.abilities) {
      createAdminDto.abilities = this.getDefaultAbilitiesForRole(createAdminDto.role);
    }

    // First, create the admin in our DB (without password)
    const { password, ...adminDataWithoutPassword } = createAdminDto;
    const created = await this.dbServices.adminUser.create({
      ...adminDataWithoutPassword,
      abilities: createAdminDto.abilities,
    });

    // Then, provision the user in Cognito
    try {
      await this.cognitoService.signUpUser(
        createAdminDto.userName, 
        createAdminDto.email, 
        password,
        createAdminDto.firstName,
        createAdminDto.lastName,
        createAdminDto.phoneNumber
      );
      return {
        adminUser: created,
        message: 'Admin user created successfully. Verification email sent to the admin.',
        requiresVerification: true
      };
    } catch (cognitoError) {
      // Rollback DB creation to keep systems consistent
      try {
        await this.dbServices.adminUser.findOneAndDelete({ adminId: created.adminId });
      } catch (_) { /* swallow rollback errors but surface original */ }
      throw new BadRequestException(`Failed to create admin user in Cognito: ${cognitoError.message}`);
    }
  }

  private getDefaultAbilitiesForRole(role: AdminRoles) {
    const abilities = [];
    
    if (role === AdminRoles.SUPER_ADMIN) {
      for (const attributeName of Object.values(AttributeNames)) {
        abilities.push({
          attributeName,
          attributeAccess: [AttributeAccess.ALL],
        });
      }
    } else if (role === AdminRoles.ADMIN) {
      for (const attributeName of Object.values(AttributeNames)) {
        abilities.push({
          attributeName,
          attributeAccess: [AttributeAccess.READ, AttributeAccess.WRITE],
        });
      }
    }
    
    return abilities;
  }

  async findAllAdminUsers(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean
  ): Promise<IPaginatedResult<IAdminUser[]>> {
    filter.isDeleted = { $in: [null, false] };
    const users = await this.paginationService.findAndPaginate(this.dbServices.adminUser, {
      skip,
      limit,
      filter,
      nonPaginated
    });
    return users;
  }

  async getAdminUserById(adminId: string): Promise<IAdminUser> {
    const adminUser = await this.dbServices.adminUser.findOne({ adminId });
    if (!adminUser) {
      throw new NotFoundException('Admin user not found');
    }
    return adminUser;
  }

  async update(adminId: string, updateAdminUserDto: UpdateAdminUserDto) {
    try {
      const adminUser = await this.dbServices.adminUser.findOne({ adminId });
      if (!adminUser) {
        throw new NotFoundException(`AdminUser with adminId ${adminId} not found`);
      }
      if (updateAdminUserDto.role == AdminRoles.SUPER_ADMIN) {
        updateAdminUserDto.abilities = [];
        for (const attributeName of Object.values(AttributeNames)) {
          updateAdminUserDto.abilities.push({
            attributeName: attributeName as string,
            attributeAccess: [AttributeAccess.ALL],
          });
        }
      }
      else if (updateAdminUserDto.role == AdminRoles.ADMIN) {
        updateAdminUserDto.abilities = [];
        for (const attributeName of Object.values(AttributeNames)) {
          updateAdminUserDto.abilities.push({
            attributeName: attributeName as string,
            attributeAccess: [AttributeAccess.READ, AttributeAccess.WRITE],
          });
        }
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

    // Since we're using Cognito for password management, delegate to Cognito service
    try {
      if (forgotPassword) {
        // Initiate forgot password flow
        await this.cognitoService.forgotPassword(adminUser.email);
        return { message: 'Password reset code sent to email' };
      } else {
        // For regular password updates, use Cognito's change password flow
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

  async getOneAdminUser(
    filter: FilterQuery<IAdminUser>
  ) {
    return await this.dbServices.adminUser.findOne(filter);
  }

  async updateRefreshToken(adminId: string, refreshToken: string) {
    return await this.dbServices.adminUser.findOneAndUpdate({ adminId }, { refreshToken: refreshToken }, { new: true });
  }

}