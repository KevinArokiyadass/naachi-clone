import { IsNumber, IsString } from 'class-validator';

export class InstitutionMetricsDto {
  @IsString()
  institutionId: string;

  @IsNumber()
  userCount: number;

  @IsNumber()
  departmentCount: number;
}
