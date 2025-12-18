import { IsNumber, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class DashboardMetricsResponseDto {
  @IsNumber()
  activeUsers: number;

  @IsNumber()
  inactiveUsers: number;

  @IsOptional()
  @IsNumber()
  reviewReportsCount?: number;

  
  @IsOptional()
  @IsNumber()
  pendingReportsCount?: number;

  @IsOptional()
  @IsNumber()
  resolvedReportsCount?: number;

  @IsOptional()
  @IsNumber()
  institutionCount?: number;

  @IsOptional()
  @IsNumber()
  departmentCount?: number;

  @IsOptional()
  @IsNumber()
  totalUsers: number;  
}
