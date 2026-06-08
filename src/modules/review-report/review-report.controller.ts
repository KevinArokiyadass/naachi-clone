import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from 'src/common/middleware/cognito.authgaurd';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AdminRoles } from 'src/common/enums/user.enum';
import { Request } from 'express';
import { ReviewReportService } from './review-report.service';
import { CreateReviewReportDto } from './dto/create-review-report.dto';
import { UpdateReviewReportDto } from './dto/update-review-report.dto';
import { ReviewReport } from './entities/review-report.entity';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';

@Controller('review-report')
export class ReviewReportController {
  constructor(private readonly service: ReviewReportService) { }

  @Post()
  create(@Body() dto: CreateReviewReportDto): Promise<ReviewReport> {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(CognitoAuthGuard, RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  findAll(@Query() query: FetchDto, @Req() req: Request): Promise<IPaginatedResult<any>> {
    const isSuperAdmin = req['isSuperAdminRequest'];
    const sessionInstitutionsId = req['institutionsId'];

    const {
      skip,
      limit,
      nonPaginated,
      search,
    } = query;

    const institutionsId = isSuperAdmin ? query.institutionsId : sessionInstitutionsId;

    let departmentsIdArray: string[] | undefined = undefined;

    if (isSuperAdmin) {
      if (query.departmentsId) {
        departmentsIdArray = [query.departmentsId];
      }
    } else {
      const adminUser = req['adminUser'];
      if (adminUser && adminUser.metaTags && Array.isArray(adminUser.metaTags)) {
        const currentMetaTag = adminUser.metaTags.find(
          (tag: any) => tag && tag.institutionsId && String(tag.institutionsId).trim() === String(sessionInstitutionsId).trim()
        );
        if (currentMetaTag && currentMetaTag.departmentsId && Array.isArray(currentMetaTag.departmentsId)) {
          departmentsIdArray = currentMetaTag.departmentsId;
        } else {
          departmentsIdArray = [];
        }
      } else {
        departmentsIdArray = [];
      }
    }

    const filter: Record<string, any> = {};

    return this.service.findAll(skip, limit, filter, nonPaginated, institutionsId, search, departmentsIdArray);
  }

  @Get(':reviewId')
  @UseGuards(CognitoAuthGuard, RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  findOne(@Param('reviewId') reviewId: string, @Req() req: Request): Promise<ReviewReport> {
    return this.service.findOne(reviewId, {
      isSuperAdminRequest: req['isSuperAdminRequest'],
      institutionsId: req['institutionsId'],
    });
  }

  @Patch(':reviewId/status')
  @UseGuards(CognitoAuthGuard, RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  update(
    @Param('reviewId') reviewId: string,
    @Body() body: UpdateReviewReportDto,
    @Req() req: Request,
  ): Promise<ReviewReport> {
    return this.service.updateStatus(reviewId, body.status, body.isBlocked, {
      isSuperAdminRequest: req['isSuperAdminRequest'],
      institutionsId: req['institutionsId'],
    });
  }

  @Delete(':reviewId')
  @UseGuards(CognitoAuthGuard, RolesGuard)
  @Roles(AdminRoles.SUPER_ADMIN, AdminRoles.INSTITUTIONADMIN)
  delete(@Param('reviewId') reviewId: string, @Req() req: Request) {
    return this.service.delete(reviewId, {
      isSuperAdminRequest: req['isSuperAdminRequest'],
      institutionsId: req['institutionsId'],
    });
  }
}
