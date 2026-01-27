import { IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConfigurationDto {
  @ApiPropertyOptional({ description: 'Maximum allowed user count', example: 500, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  allowedUserCount?: number;

  @ApiPropertyOptional({ description: 'Force restrict new user onboarding', example: true })
  @IsOptional()
  @IsBoolean()
  forceRestrictOnboarding?: boolean;
}
