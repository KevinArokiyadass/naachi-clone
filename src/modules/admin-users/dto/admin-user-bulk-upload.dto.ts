import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

const toBoolean = (value: unknown, defaultValue = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
  }
  return defaultValue;
};

export class AdminUserBulkUploadDto {
  @IsOptional()
  @Transform(({ value }) => toBoolean(value, false))
  @IsBoolean()
  dryRun?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value, true))
  @IsBoolean()
  skipExisting?: boolean = true;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value, false))
  @IsBoolean()
  updateExisting?: boolean = false;

  @IsOptional()
  @IsString()
  defaultRegion?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

