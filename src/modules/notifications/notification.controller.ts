import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { RegisterDeviceTokenDto } from "./dto/device-registration.dto";
import { NotificationService } from "./notification.service";
import { Logger } from "@nestjs/common";
import { Patch } from "@nestjs/common";
import { UpdateDeviceTokenDto } from "./dto/device-registration.dto";
import { IDeviceRegistrationResponse } from "src/common/interfaces/notification.interface";
import { Query } from "@nestjs/common";
import { Delete } from "@nestjs/common";
import { Param } from "@nestjs/common";
import { Put } from "@nestjs/common";
import { Get } from "@nestjs/common";
import { ApiParam } from "@nestjs/swagger";
import { ApiQuery } from "@nestjs/swagger";
import { NotificationStatus } from "src/common/enums/notification.enum";
import { CreateNotificationHistoryDto } from "./dto/create-notification.dto";
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';
import { toStringArray } from "src/common/utils/string-array.util";
import { PaginationService } from "src/common/shared/pagination/pagination.service";
import { CreateBulkNotificationDto } from "./dto/create-bulk-notification.dto";
import { DismissNotificationsDto } from "./dto/dismiss-notification.dto";


@Controller("notifications")
@ApiTags('user-notifications')
export class NotificationController {
  private readonly Logger: Logger;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly paginationService: PaginationService
  ) {
    this.Logger = new Logger(NotificationController.name);
  }

  @Post('device-register')
  async registerDeviceToken(@Body() registerDto: RegisterDeviceTokenDto): Promise<IDeviceRegistrationResponse> {
    this.Logger.log(`Registering device token for ${registerDto.deviceType} device`);
    return this.notificationService.registerDeviceToken(registerDto);
  }

  @Patch('device-update')
  async updateDeviceToken(@Body() updateDto: UpdateDeviceTokenDto): Promise<IDeviceRegistrationResponse> {
    this.Logger.log(`Updating device token: ${updateDto.token}`);
    return this.notificationService.updateDeviceToken(updateDto);
  }

  @Get('device')
  async getAllDevices(@Query() query: FetchDto) {
    this.Logger.log(`Getting all devices`);
    const { skip, limit, isActive, nonPaginated, deviceId, deviceTokenId, deviceType, userId } = query;

    let filters: any = {};
    if (deviceId && deviceId.trim()) {
      const deviceIds = toStringArray(deviceId);
      filters.deviceId = { $in: deviceIds };
    }

    if (deviceTokenId && deviceTokenId.trim()) {
      const deviceTokenIds = toStringArray(deviceTokenId);
      filters.deviceTokenId = { $in: deviceTokenIds };
    }

    if (deviceType && deviceType.trim()) {
      const deviceTypes = toStringArray(deviceType);
      filters.deviceType = { $in: deviceTypes };
    }

    if (userId && userId.trim()) {
      const userIds = toStringArray(userId);
      filters.userId = { $in: userIds };
    }

    if (isActive !== undefined) {
      filters.isActive = isActive;
    } else {
      filters.isActive = { $in: [true, null] };
    }

    return this.notificationService.getAllDevices(skip, limit, nonPaginated, filters);
  }

  @Delete('device/token/:userId')
  async deactivateDeviceToken(@Param('userId') userId: string, @Query('fcmToken') fcmToken: string): Promise<IDeviceRegistrationResponse> {
    this.Logger.log(`Deactivating device token: ${fcmToken}`);
    return this.notificationService.deactivateDeviceToken(userId, fcmToken);
  }

  @Post()
  async createNotification(@Body() createNotificationHistoryDto: CreateNotificationHistoryDto): Promise<any> {
    this.Logger.log('Creating notification and sending to user devices');
    return this.notificationService.createNotificationRecord(createNotificationHistoryDto);
  }

  @Post('dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss chat notifications for a user and ticketId' })
  @ApiBody({
    type: DismissNotificationsDto,
    description:
      'Dismiss chat notifications for a user and ticketId. If messageIds is provided, only those messages are dismissed; otherwise all chat notifications for the ticket are dismissed.'
  })
  @ApiResponse({ status: 200, description: 'Notifications dismissed successfully' })
  async dismissNotifications(@Body() dto: DismissNotificationsDto) {
    this.Logger.log(
      `Dismissing notifications for userId=${dto.userId}, ticketId=${dto.ticketId}, chatType=${dto.chatType}, messageIdsCount=${dto.messageIds?.length ?? 0}`
    );
    return this.notificationService.dismissChatNotifications(dto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send bulk notifications to multiple device tokens' })
  @ApiResponse({ status: 200, description: 'Bulk notifications processed' })
  async sendBulkNotification(@Body() bulkDto: CreateBulkNotificationDto) {
    this.Logger.log(`Sending bulk notification. userIds=${bulkDto.userIds?.length || 0}, tokens=${bulkDto.tokens?.length || 0}`);
    return this.notificationService.sendBulkNotification(bulkDto);
  }


  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get notification history with filters and pagination' })
  @ApiQuery({ name: 'notificationId', required: false, description: 'Filter by notification ID' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by notification status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of records to return', type: Number })
  @ApiQuery({ name: 'skip', required: false, description: 'Number of records to skip', type: Number })
  @ApiResponse({ status: 200, description: 'Notification history retrieved successfully' })
  async getNotificationHistory(@Query() queryDto: FetchDto) {
    this.Logger.log('Getting notification history');

    const { skip, limit, nonPaginated, status, userId } = queryDto;

    let filter: any = {};

    if (userId) {
      const arrayuserIds = toStringArray(userId);
      filter.userId = { $in: arrayuserIds };
    }

    if (status) {
      filter.status = status;
    }

    return this.notificationService.getNotificationHistory(skip, limit, filter, nonPaginated);
  }

  @Get(':notificationId')
  async getNotificationHistoryWithId(@Param('notificationId') notificationId: string) {
    this.Logger.log('Getting notification history with id');
    return this.notificationService.getNotificationHistoryWithId(notificationId);
  }

  @Put(':notificationId/status')
  async updateNotificationStatus(@Param('notificationId') notificationId: string, @Body('status') status: NotificationStatus) {
    this.Logger.log('Updating notification status');
    return this.notificationService.updateNotificationStatus(notificationId, status);
  }

  @Get('count/:userId')
  async getCountOfNotificationsByUserId(@Param('userId') userId: string) {
    this.Logger.log('Getting count of notifications by userId');
    return this.notificationService.getCountOfNotificationsByUserId(userId);
  }
}