import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ReviewReportService } from './review-report.service';
import { CreateReviewReportDto } from './dto/create-review-report.dto';
import { UpdateReviewReportDto } from './dto/update-review-report.dto';
import { ReviewReport } from './entities/review-report.entity';

@Controller('review-report')
export class ReviewReportController {
  constructor(private readonly service: ReviewReportService) { }

  @Post()
  create(@Body() dto: CreateReviewReportDto): Promise<ReviewReport> {
    return this.service.create(dto);
  }

  @Get()
  findAll(): Promise<ReviewReport[]> {
    return this.service.findAll();
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
