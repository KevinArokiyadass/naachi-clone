import { IsObject, IsOptional, IsString } from "class-validator";

export class CreateNotificationHistoryDto {
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

    @IsOptional()
    @IsString()
    userId?: string;
}   