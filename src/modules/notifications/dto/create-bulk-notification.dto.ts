import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

export class CreateBulkNotificationDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tokens?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    userIds?: string[];

    @IsString()
    title: string;

    @IsString()
    body: string;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    clickAction?: string;

    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
}
