import { IsNumber, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { InstitutionMetricsDto } from 'src/modules/dashboard/dto/institution-metrics-dto';

export class DashboardMetricsResponseDto {
  @IsNumber()
  activeUsers: number;

  @IsNumber()
  inactiveUsers: number;

  @IsOptional()
  @IsNumber()
  reviewReports?: number;

  @IsOptional()
  @IsNumber()
  totalReviews?: number;

  @IsOptional()
  @IsNumber()
  institutionCount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstitutionMetricsDto)
  institutions?: InstitutionMetricsDto[];
}
