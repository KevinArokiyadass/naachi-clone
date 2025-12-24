import { IsNumber, IsOptional, IsArray } from 'class-validator';

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

  @IsOptional()
  @IsArray()
  institutionBreakdown?: Array<Record<string, any> & { activeUsers: number }>;
}
