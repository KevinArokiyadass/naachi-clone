import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { AdminRoles } from 'src/common/enums/user.enum';
import { CognitoAuthGuard } from 'src/common/middleware/cognito.authgaurd';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserBulkUploadDto } from './dto/user-bulk-upload.dto';
import { UserBulkUploadService } from './bulk-upload/user-bulk-upload.service';
import { UserBulkRateLimitGuard } from './bulk-upload/user-bulk-rate-limit.guard';
import { UsersAuthService } from './users.service';
import { UserBulkUploadResult } from './bulk-upload/user-bulk-upload.types';

/**
 * Institution-scoped user bulk upload routes only.
 * Kept separate from {@link UsersController} so {@link ClientIdMiddleware}
 * can run here without forcing `Origin` on public user-auth routes.
 */
@Controller('users/:institutionsId')
export class UsersInstitutionBulkController {
  constructor(
    private readonly usersService: UsersAuthService,
    private readonly userBulkUploadService: UserBulkUploadService,
  ) {}

  private assertUserBulkUploadHasSuccessRows(result: UserBulkUploadResult): void {
    if (result.failureCount > 0 && result.successCount === 0) {
      const isAllRejected =
        result.rejectedCount > 0 && result.rejectedCount === result.failureCount;
      const message = isAllRejected
        ? 'Bulk upload rejected: all rows are users already linked to this institution with no changes to apply.'
        : 'Bulk upload did not import any users. Fix invalid values and try again. If present, decode rejectedExcelBase64 using rejectedExcelFileName for rejected rows.';
      throw new UnprocessableEntityException({
        message,
        ...result,
      });
    }
  }

  @Post('bulk-upload')
  @UseGuards(CognitoAuthGuard, RolesGuard, UserBulkRateLimitGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async bulkUploadUsersByInstitution(
    @Param('institutionsId') institutionsId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() bulkUploadDto: UserBulkUploadDto,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const result = await this.userBulkUploadService.processUpload(file, bulkUploadDto, {
      institutionsId,
      requestInstitutionsId: req['institutionsId'] as string | undefined,
      isSuperAdminRequest: Boolean(req['isSuperAdminRequest']),
    });
    this.assertUserBulkUploadHasSuccessRows(result);
    return result;
  }

  @Get('bulk-upload/template')
  @UseGuards(CognitoAuthGuard, RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  async downloadBulkUploadTemplateByInstitution(
    @Param('institutionsId') institutionsId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.usersService.validateInstitutionScope(institutionsId, {
      institutionsId: req['institutionsId'] as string | undefined,
      isSuperAdminRequest: Boolean(req['isSuperAdminRequest']),
    });
    const { fileName, fileBuffer } =
      await this.usersService.getInstitutionBulkUploadTemplate(institutionsId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileBuffer);
  }
}
