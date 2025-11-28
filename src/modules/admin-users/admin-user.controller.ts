import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminUserService } from './admin-user.service';
import { CreateAdminWithPasswordDto } from './dto/create-admin-with-password.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { FetchAdminUsersDto } from './dto/fetch-admin-users.dto';
import { AdminRoles } from 'src/common/enums/user.enum';
import { ClientIdMiddleware } from 'src/common/middleware/clientId.middlewere';
import { LoggerMiddleware } from 'src/common/middleware/logger.middlewere';
import { MiddlewareConsumer } from '@nestjs/common';



@Controller('admin-user')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) { }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create complete admin user with authentication' })
  @ApiResponse({ status: 201, description: 'Admin user created and verification email sent' })
  async createAdminUser(@Body() createAdminDto: CreateAdminWithPasswordDto) {
    return await this.adminUserService.createAdminUser(createAdminDto);
  }

  
  @Get()
  getAllAdminUsers(
    @Query() fetchDto: FetchAdminUsersDto
  ) {
    const { skip, limit, nonPaginated, role, status, institutionsId, departmentsId } = fetchDto;
    const filter: Record<string, any> = {};
    if (role === AdminRoles.INSTITUTIONADMIN && !institutionsId) {
      throw new BadRequestException('institutionsId is required for institutional admins');
     }

    if (role) {
      filter.role = role;
    }
    if (status) {
      filter.status = status;
    }
    if (institutionsId) 
      {
        filter['metaTags.institutionsId'] = institutionsId;
       } 
    if (departmentsId)
      {
        filter['metaTags.departmentsId'] = departmentsId;
      }

    return this.adminUserService.findAllAdminUsers(skip, limit, filter, nonPaginated);
  }

  @Get(':adminId')
  findOne(@Param('adminId') adminId: string) {
    return this.adminUserService.getAdminUserById(adminId);
  }

  @Put(':adminId')
  async updateAdminUser(
    @Param('adminId') adminId: string,
    @Body() updateAdminUserDto: UpdateAdminUserDto
  ) {
    return await this.adminUserService.update(adminId, updateAdminUserDto);
  }

  @Patch(':adminId/password')
  async updatePassword(
    @Param('adminId') adminId: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
    @Query('forgotPassword') forgotPassword: boolean
  ) {
    try {
      const result = await this.adminUserService.updatePassword(adminId, updatePasswordDto, forgotPassword);
      return result;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Unable to update the password');
    }
  }

  @Patch(':adminId/status')
  async updateStatus(
    @Param('adminId') adminId: string,
    @Body('status') status: 'active' | 'inactive',
  ) {
    if (!['active', 'inactive'].includes(status)) {
      throw new BadRequestException('Status must be either active or inactive');
    }
    return this.adminUserService.updateStatus(adminId, status);
  }

  @Delete(':adminId')
  remove(@Param('adminId') adminId: string) {
    return this.adminUserService.deleteAdminUser(adminId);
  }

} 