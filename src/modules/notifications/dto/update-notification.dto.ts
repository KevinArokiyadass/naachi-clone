import { IsEnum, IsOptional, IsObject, IsString } from "class-validator";
import { NotificationStatus } from "../../../common/enums/notification.enum";

export class UpdateNotificationStatusDto {
    @IsEnum(NotificationStatus)
    status: NotificationStatus;

    @IsOptional()
    @IsObject()
    deliveryResults?: any;

    @IsOptional()
    @IsString()
    fcmMessageId?: string;

    @IsOptional()
    @IsObject()
    fcmResponse?: any;

    @IsOptional()
    @IsString()
    errorMessage?: string;
}