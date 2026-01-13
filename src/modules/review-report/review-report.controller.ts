import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req } from '@nestjs/common';
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

    // Use query param for superadmin (allows "all" if undefined), 
    // but force session ID for normal institution admins.
    const institutionsId = isSuperAdmin ? query.institutionsId : sessionInstitutionsId;

    const filter: Record<string, any> = {};

    if (search) {
      filter.$or = [
        { reviewId: { $regex: search, $options: 'i' } },
        { reasonText: { $regex: search, $options: 'i' } },
        { conversationId: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } },
      ];
    }

    return this.service.findAll(skip, limit, filter, nonPaginated, institutionsId);
  }

  @Get(':reviewId')
  findOne(@Param('reviewId') reviewId: string): Promise<ReviewReport> {
    return this.service.findOne(reviewId);
  }

  @Patch(':reviewId/status')
  update(@Param('reviewId') reviewId: string, @Body('status') status: string): Promise<ReviewReport> {
    return this.service.updateStatus(reviewId, status);
  }

  @Delete(':reviewId')
  delete(@Param('reviewId') reviewId: string) {
    return this.service.delete(reviewId);
  }
}
