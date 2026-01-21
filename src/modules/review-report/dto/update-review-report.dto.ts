import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewReportDto } from './create-review-report.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateReviewReportDto extends PartialType(CreateReviewReportDto) {
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
