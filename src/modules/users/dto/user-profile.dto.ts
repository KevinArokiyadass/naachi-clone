import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { USER_STATUS, ReferrerMedium } from 'src/common/enums/user.enum';

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

  @IsOptional()
  @IsEnum(Object.values(USER_STATUS), {
    message: `Status must be one of: ${Object.values(USER_STATUS).join(', ')}`,
  })
  status?: string;

  @IsOptional()
  @IsEnum(ReferrerMedium, {
    message: `ReferrerMedium must be one of: ${Object.values(ReferrerMedium).join(', ')}`,
  })
  referrerMedium?: ReferrerMedium;

  @IsOptional()
  @IsString()
  referrerId?: string;
}

