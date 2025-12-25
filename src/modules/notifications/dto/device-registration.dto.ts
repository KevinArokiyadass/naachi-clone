import { IsString, IsOptional, IsEnum, IsBoolean, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { DeviceType, Platform } from "src/common/enums/device.enum";

export class RegisterDeviceTokenDto {
  @IsString()
  token: string;

  @IsEnum(DeviceType)
  deviceType: DeviceType;

  @IsEnum(Platform)
  platform: Platform;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;
}

export class UpdateDeviceTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(DeviceType)
  deviceType?: DeviceType;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}

export class SendNotificationByDeviceDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(DeviceType)
  deviceType?: DeviceType;

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;
}

export class BulkNotificationDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(DeviceType)
  deviceType?: DeviceType;

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform;

  @IsOptional()
  @IsString()
  topic?: string;
}
