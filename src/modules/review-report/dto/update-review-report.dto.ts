import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewReportDto } from './create-review-report.dto';

export class UpdateReviewReportDto extends PartialType(CreateReviewReportDto) {}
