import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class FetchDto {
  @IsOptional()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  skip: number = 0;

  @IsOptional()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  limit: number = 10;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  filter: string = '{}';

  @IsOptional()
  @IsNotEmpty()
  @IsBoolean()
  @Type(() => Boolean)
  deleted: boolean = false;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsBoolean()
  @Type(() => Boolean)
  nonPaginated: boolean = false;


  @IsOptional()
  @IsString()
  isActive?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceTokenId?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  institutionsId?: string;
}