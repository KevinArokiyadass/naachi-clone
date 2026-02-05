import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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
import { CognitoAuthGuard } from 'src/common/middleware/cognito.authgaurd';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/public.decorator';



@Controller('admin-user')
@UseGuards(CognitoAuthGuard)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) { }

  @Post('create')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create complete admin user with authentication' })
  @ApiResponse({ status: 201, description: 'Admin user created and verification email sent' })
  async createAdminUser(@Body() createAdminDto: CreateAdminWithPasswordDto) {
    return await this.adminUserService.createAdminUser(createAdminDto);
  }


  @Get()
  getAllAdminUsers(
    @Query() fetchDto: FetchAdminUsersDto,
    @Req() req: Request
  ) {
    const { skip, limit, nonPaginated, role, status, departmentsId, search } = fetchDto;
    const filter: Record<string, any> = {};
    if (role === AdminRoles.INSTITUTIONADMIN && !req['institutionsId']) {
      throw new BadRequestException('institutionsId is required for institutional admins');
    }

    if (role) {
      filter.role = role;
    }
    if (status) {
      filter.status = status;
    }
    if (req['institutionsId']) {
      filter['metaTags.institutionsId'] = req['institutionsId'] as string;
    }
    else{
      filter['metaTags.institutionsId'] = {$exists: false};
    }
    if (departmentsId) {
      filter['metaTags.departmentsId'] = departmentsId as string;
    }

    if (search) {
      // When search is provided, search across admin-facing fields (excluding adminId)
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
      ];
    }

    return this.adminUserService.findAllAdminUsers(skip, limit, filter, nonPaginated);
  }

  @Get(':adminId')
  findOne(@Param('adminId') adminId: string) {
    return this.adminUserService.getAdminUserById(adminId);
  }

  @Put(':adminId')
  @UseGuards(RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN)
  async updateAdminUser(
    @Param('adminId') adminId: string,
    @Body() updateAdminUserDto: UpdateAdminUserDto
  ) {
    return await this.adminUserService.update(adminId, updateAdminUserDto);
  }

  @Patch(':adminId/password')
  @UseGuards(RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN)
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
  @UseGuards(RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN)
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
  @UseGuards(RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN)
  remove(@Param('adminId') adminId: string) {
    return this.adminUserService.deleteAdminUser(adminId);
  }

} 