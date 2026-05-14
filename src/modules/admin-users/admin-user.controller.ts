import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors, UnprocessableEntityException } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';
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
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminUserBulkUploadDto } from './dto/admin-user-bulk-upload.dto';
import { AdminUserBulkUploadService } from './bulk-upload/admin-user-bulk-upload.service';
import { AdminUserBulkRateLimitGuard } from './bulk-upload/admin-user-bulk-rate-limit.guard';
import { AdminUserBulkUploadResult } from './bulk-upload/admin-user-bulk-upload.types';
import { Response } from 'express';



@Controller('admin-user')
@UseGuards(CognitoAuthGuard)
export class AdminUserController {
  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly adminUserBulkUploadService: AdminUserBulkUploadService,
  ) { }

  /**
   * When every row fails, respond with 422 so HTTP clients do not treat the call as a generic success.
   * Row-level details and optional rejected-rows spreadsheet remain on the exception body.
   */
  private assertAdminBulkUploadHasSuccessRows(result: AdminUserBulkUploadResult): void {
    if (result.failureCount > 0 && result.successCount === 0) {
      throw new UnprocessableEntityException({
        message:
          'Bulk upload did not import any rows. Fix invalid values and try again. If present, decode rejectedExcelBase64 using rejectedExcelFileName for rejected rows.',
        ...result,
      });
    }
  }

  @Post('create')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create complete admin user with authentication' })
  @ApiResponse({ status: 201, description: 'Admin user created and verification email sent' })
  async createAdminUser(@Body() createAdminDto: CreateAdminWithPasswordDto) {
    return await this.adminUserService.createAdminUser(createAdminDto);
  }

  @Post('onboarding-institution')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create onboarding admin user mapping all permissions automatically without mandatory department' })
  @ApiResponse({ status: 201, description: 'Onboarding admin created with all permissions mapped' })
  async createOnboardingAdminUser(@Body() createAdminDto: any) {
    return await this.adminUserService.createOnboardingAdminUser(createAdminDto);
  }

  @Post('bulk-upload')
  @UseGuards(RolesGuard, AdminUserBulkRateLimitGuard)
  @Roles(AdminRoles.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        dryRun: { type: 'boolean' },
        skipExisting: { type: 'boolean' },
        updateExisting: { type: 'boolean' },
        defaultRegion: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 422, description: 'No rows were imported (all rows invalid, duplicate, or failed).' })
  async bulkUploadAdmins(
    @UploadedFile() file: Express.Multer.File,
    @Body() bulkUploadDto: AdminUserBulkUploadDto,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const requestInstitutionsId = req['institutionsId'] as string | undefined;
    const result = await this.adminUserBulkUploadService.processUpload(file, bulkUploadDto, {
      institutionsId: requestInstitutionsId,
      requestInstitutionsId,
      isSuperAdminRequest: Boolean(req['isSuperAdminRequest']),
    });
    this.assertAdminBulkUploadHasSuccessRows(result);
    return result;
  }

  @Post(':institutionsId/bulk-upload')
  @UseGuards(RolesGuard, AdminUserBulkRateLimitGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        dryRun: { type: 'boolean' },
        skipExisting: { type: 'boolean' },
        updateExisting: { type: 'boolean' },
        defaultRegion: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 422, description: 'No rows were imported (all rows invalid, duplicate, or failed).' })
  async bulkUploadAdminsByInstitution(
    @Param('institutionsId') institutionsId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() bulkUploadDto: AdminUserBulkUploadDto,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const result = await this.adminUserBulkUploadService.processUpload(file, bulkUploadDto, {
      institutionsId,
      requestInstitutionsId: req['institutionsId'] as string | undefined,
      isSuperAdminRequest: Boolean(req['isSuperAdminRequest']),
    });
    this.assertAdminBulkUploadHasSuccessRows(result);
    return result;
  }

  @Get('bulk-upload/template')
  @UseGuards(RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  @ApiOperation({ summary: 'Download admin user bulk upload template' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async downloadBulkUploadTemplate(@Res() res: Response) {
    const { fileName, fileBuffer } = await this.adminUserService.getBulkUploadTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=\"${fileName}\"`);
    res.send(fileBuffer);
  }

  @Get(':institutionsId/bulk-upload/template')
  @UseGuards(RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  @ApiOperation({ summary: 'Download institution scoped admin user bulk upload template' })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async downloadBulkUploadTemplateByInstitution(
    @Param('institutionsId') institutionsId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.adminUserService.validateInstitutionScope(institutionsId, {
      institutionsId: req['institutionsId'] as string | undefined,
      isSuperAdminRequest: Boolean(req['isSuperAdminRequest']),
    });
    const { fileName, fileBuffer } = await this.adminUserService.getInstitutionBulkUploadTemplate(institutionsId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=\"${fileName}\"`);
    res.send(fileBuffer);
  }

  @Get(':institutionsId/bulk-upload/options')
  @UseGuards(RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  @ApiOperation({ summary: 'Get institution scoped permission groups and departments for bulk upload dropdowns' })
  async getBulkUploadOptions(
    @Param('institutionsId') institutionsId: string,
    @Req() req: Request,
  ) {
    this.adminUserService.validateInstitutionScope(institutionsId, {
      institutionsId: req['institutionsId'] as string | undefined,
      isSuperAdminRequest: Boolean(req['isSuperAdminRequest']),
    });
    return this.adminUserService.getBulkUploadOptions(institutionsId);
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