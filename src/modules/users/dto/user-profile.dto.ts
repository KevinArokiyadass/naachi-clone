import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  s3FileName?: string;

  @IsOptional()
  @IsBoolean()
  showPhoneNumber?: boolean;

  @IsOptional()
  @IsBoolean()
  muteNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  disableReadReceipt?: boolean;
}

