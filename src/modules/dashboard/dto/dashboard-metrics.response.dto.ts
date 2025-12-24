import { IsNumber, IsOptional, ValidateNested, IsArray, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class InstitutionUserBreakdown {
  @IsString()
  institutionName: string;

  @IsNumber()
  activeUsers: number;
}

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
  @ValidateNested({ each: true })
  @Type(() => InstitutionUserBreakdown)
  institutionBreakdown?: InstitutionUserBreakdown[];
}
