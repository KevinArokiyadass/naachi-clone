import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req } from '@nestjs/common';
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

    const filter: Record<string, any> = {};

    return this.service.findAll(skip, limit, filter, nonPaginated, institutionsId, search);
  }

  @Get(':reviewId')
  findOne(@Param('reviewId') reviewId: string, @Req() req: Request): Promise<ReviewReport> {
    return this.service.findOne(reviewId, {
      isSuperAdminRequest: req['isSuperAdminRequest'],
      institutionsId: req['institutionsId'],
    });
  }

  @Patch(':reviewId/status')
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
  delete(@Param('reviewId') reviewId: string, @Req() req: Request) {
    return this.service.delete(reviewId, {
      isSuperAdminRequest: req['isSuperAdminRequest'],
      institutionsId: req['institutionsId'],
    });
  }
}
