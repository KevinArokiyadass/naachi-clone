import { Injectable } from "@nestjs/common";
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { RegisterDeviceTokenDto } from "./dto/device-registration.dto";
import { DeviceType } from "../../common/enums/device.enum";
import { BadRequestException } from "@nestjs/common";
import { Platform } from "../../common/enums/device.enum";
import { IDeviceRegistrationResponse } from "../../common/interfaces/notification.interface";
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import { UpdateDeviceTokenDto } from "./dto/device-registration.dto";
import { NotFoundException } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { FirebaseConfig } from "src/common/config/firebase.config";
import { FirebaseService } from "../firebase/firebase.service";
import { CreateNotificationHistoryDto } from "./dto/create-notification.dto";
import { NotificationHistory } from "./entity/notification-management.entity"
import { NotificationStatus } from "../../common/enums/notification.enum";
import { CreateBulkNotificationDto } from "./dto/create-bulk-notification.dto";
import { HttpClientService } from "src/common/inter-service-communication/http-client.service";
import { DismissNotificationsDto } from "./dto/dismiss-notification.dto";


@Injectable()
export class NotificationService {
  constructor(
    private readonly dbServices: IMongoDBServices,
    private readonly paginationService: PaginationService,
    private readonly firebaseService: FirebaseService,
    private readonly httpClientService: HttpClientService
  ) {
    this.Logger = new Logger(NotificationService.name);
  }

  private readonly Logger: Logger;

  /**
   * Firebase `data` payload must be `Record<string, string>`.
   * This helper converts any plain object into that shape by
   * stringifying non-string values. Nested objects/arrays are JSON-stringified.
   */
  private normalizeFirebaseDataPayload(data: any): Record<string, string> | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    const normalized: Record<string, string> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) {
        // Skip undefined to avoid sending "undefined" as a literal string
        return;
      }

      if (value === null) {
        normalized[key] = '';
        return;
      }

      if (typeof value === 'string') {
        normalized[key] = value;
        return;
      }

      if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        normalized[key] = String(value);
        return;
      }

      // Objects, arrays, Dates, etc.
      try {
        normalized[key] = JSON.stringify(value);
      } catch {
        // Fallback in worst case
        normalized[key] = String(value);
      }
    });

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  /* Generate full CloudFront URL from filename */
  private generateImageUrl(filename: string): string | null {
    if (!filename) {
      return null;
    }

    // If a full URL is already provided (e.g. from chat-service), respect it as-is.
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }

    const cloudFrontUrl = process.env.CLOUD_FRONT_URL;
    if (!cloudFrontUrl) {
      this.Logger.warn('CLOUD_FRONT_URL environment variable not set');
      return null;
    }

    const baseUrl = cloudFrontUrl.replace(/\/$/, '');
    return `${baseUrl}/${filename}`;
  }

  private transformNotificationWithImageUrl(notification: any): any {
    if (!notification) return notification;

    return {
      ...notification,
      imageUrl: notification.imageUrl ? this.generateImageUrl(notification.imageUrl) : notification.imageUrl
    };
  }

  private transformNotificationsWithImageUrls(notifications: any[]): any[] {
    if (!notifications || !Array.isArray(notifications)) return notifications;

    return notifications.map(notification => this.transformNotificationWithImageUrl(notification));
  }

  private validateDeviceRegistration(registerDto: RegisterDeviceTokenDto): void {
    if (registerDto.deviceType === DeviceType.WEB && !registerDto.deviceId) {
      throw new BadRequestException('Device ID is required for web devices');
    }

    if (registerDto.deviceType === DeviceType.MOBILE && !registerDto.deviceId) {
      throw new BadRequestException('Device ID is required for mobile devices');
    }

    if ((registerDto.platform === Platform.ANDROID || registerDto.platform === Platform.IOS)
      && registerDto.deviceType !== DeviceType.MOBILE) {
      throw new BadRequestException('Mobile platforms must be used with mobile device type');
    }
  }

  async registerDeviceToken(registerDto: RegisterDeviceTokenDto): Promise<IDeviceRegistrationResponse> {
    try {
      this.validateDeviceRegistration(registerDto);

      // 1. Check if this exact token exists (regardless of user)
      const existingTokenRecord = await this.dbServices.deviceToken.findOne({
        token: registerDto.token
      });

      if (existingTokenRecord) {
        this.Logger.log(`Token already exists. Updating ownership and status for userId: ${registerDto.userId}`);
        const updated = await this.dbServices.deviceToken.findOneAndUpdate(
          { token: registerDto.token },
          {
            ...registerDto,
            isActive: true
          },
          { new: true }
        );
        return updated as IDeviceRegistrationResponse;
      }

      // 2. If it's a NEW token, we follow the "One active token per deviceType" rule
      // Deactivate any other active tokens for this user and deviceType
      await this.dbServices.deviceToken.updateMany(
        {
          userId: registerDto.userId,
          deviceType: registerDto.deviceType,
          isActive: true
        },
        { isActive: false }
      );

      // 3. Create the new token
      const deviceToken = await this.dbServices.deviceToken.create({
        ...registerDto,
        isActive: true
      });

      this.Logger.log(`Registered NEW device token for ${registerDto.deviceType} device`);
      return deviceToken as IDeviceRegistrationResponse;
    } catch (error) {
      this.Logger.error('Error registering device token:', error);
      throw error;
    }
  }

  /* Update device token information */
  async updateDeviceToken(updateDto: UpdateDeviceTokenDto): Promise<IDeviceRegistrationResponse> {
    try {
      const existingToken = await this.dbServices.deviceToken.findOne({ token: updateDto.token });

      if (!existingToken) {
        throw new NotFoundException('Device token not found');
      }

      if (existingToken.token !== updateDto.token) {
        // If updating to active, check restrictions
        if (updateDto.isActive === true) {
          // Check if user already has an active token for this device type (excluding current token)
          const existingDeviceTypeToken = await this.dbServices.deviceToken.findOne({
            userId: updateDto.userId || existingToken.userId,
            deviceType: updateDto.deviceType,
            isActive: true,
            token: { $ne: updateDto.token } // Exclude current token
          });

          if (existingDeviceTypeToken) {
            throw new BadRequestException(
              `User already has an active ${updateDto.deviceType} device token. Only one token per device type is allowed.`
            );
          }

          // Check if the same device ID already has an active token (excluding current token)
          if (updateDto.deviceId) {
            const existingDeviceIdToken = await this.dbServices.deviceToken.findOne({
              deviceId: updateDto.deviceId,
              isActive: true,
              token: { $ne: updateDto.token } // Exclude current token
            });

            if (existingDeviceIdToken) {
              throw new BadRequestException(
                `Device ID ${updateDto.deviceId} already has an active token. Each device can only have one active token.`
              );
            }
          }
        }
      }


      const updatedToken = await this.dbServices.deviceToken.findOneAndUpdate({ token: updateDto.token }, updateDto);
      if (!updatedToken) {
        throw new NotFoundException('Failed to update device token');
      }

      this.Logger.log(`Updated device token: ${updateDto.token}`);
      return updatedToken as IDeviceRegistrationResponse;
    } catch (error) {
      this.Logger.error('Error updating device token:', error);
      throw error;
    }
  }

  /* Get all devices */
  async getAllDevices(skip: number, limit: number, nonPaginated: boolean, filter: any) {
    try {
      const deviceDetails = await this.paginationService.findAndPaginate(
        this.dbServices.deviceToken,
        {
          filter,
          skip,
          limit,
          nonPaginated
        })

      return deviceDetails
    } catch (error) {
      console.warn('Error getting all devices:', error);
      throw new BadRequestException(`Error while getting device details: ${error.message} `);
    }
  }

  /* Deactivate device token */
  async deactivateDeviceToken(userId: string, fcmToken: string): Promise<IDeviceRegistrationResponse> {
    try {
      const deviceToken = await this.dbServices.deviceToken.findOneAndUpdate({ token: fcmToken, userId }, { isActive: false });
      if (!deviceToken) {
        throw new NotFoundException('Device token not found');
      }
      return deviceToken as IDeviceRegistrationResponse;
    } catch (error) {
      this.Logger.error(`Error deactivating device token ${fcmToken}:`, error);
      throw error;
    }
  }

  //   notification service layer below
  /**
   * Check if the receiver has muted notifications from the sender (connection-level muteNotification).
   * Uses the connection collection via chat service: ownerId = receiver, peerId = sender.
   * Returns true if muted, false otherwise. On API error or no connection, returns false (allow notification).
   */
  private async isSenderMutedByReceiver(receiverId: string, senderId: string): Promise<boolean> {
    try {
      const response: any = await this.httpClientService.get(
        'NAACHI_CHAT_SERVICE',
        '/connection',
        { ownerId: receiverId, skip: 0, limit: 100 },
        true
      );
      if (!response) return false;
      const items = response?.items ?? response?.result?.items ?? [];
      const connection = items.find((c: any) => c.peerId === senderId);
      if (!connection) return false;
      return connection.muteNotification === true;
    } catch {
      return false;
    }
  }

  /** True when FCM must not run (user mute or connection-level mute). In-app row may still exist. */
  private async shouldSkipFcmForUser(userId: string, senderId?: string): Promise<boolean> {
    const userProfile = await this.dbServices.users.findOne({ userId }, { muteNotifications: 1 });
    if (userProfile?.muteNotifications === true) {
      return true;
    }
    if (senderId && (await this.isSenderMutedByReceiver(userId, senderId))) {
      return true;
    }
    return false;
  }

  /* Create notification history record and send Firebase notification */
  async createNotificationRecord(createNotificationHistoryDto: CreateNotificationHistoryDto) {
    try {
      const userId = createNotificationHistoryDto.userId;

      if (userId) {
        this.Logger.log(`Creating notification record for userId: ${userId}`);
      }

      // Chat flow can occasionally call POST /notifications more than once
      // for the same message/user (e.g. navigation-triggered sends). To avoid
      // duplicate in-app entries, we de-duplicate by (userId, messageId/msgId).
      const data = createNotificationHistoryDto.data || {};
      const messageId = data.messageId ?? data.msgId;

      if (userId && messageId) {
        const existingNotification = await this.dbServices.notificationHistory.findOne({
          userId,
          $or: [
            { 'data.messageId': messageId },
            { 'data.msgId': messageId },
          ],
        });

        if (existingNotification) {
          this.Logger.log(
            `Duplicate notification detected for userId ${userId} and messageId ${messageId}; returning existing notification ${existingNotification.notificationId}`
          );
          if (existingNotification.status === NotificationStatus.FAILED) {
            const senderId = createNotificationHistoryDto.data?.senderId;
            if (!(await this.shouldSkipFcmForUser(userId, senderId))) {
              this.Logger.log(
                `Retrying FCM for previously failed notification ${existingNotification.notificationId}`
              );
              await this.sendNotificationToUser(existingNotification);
            }
          }
          const refreshed = await this.dbServices.notificationHistory.findOne({
            notificationId: existingNotification.notificationId,
          });
          return refreshed ?? existingNotification;
        }
      }

      const historyRecord: CreateNotificationHistoryDto = {
        title: createNotificationHistoryDto.title,
        body: createNotificationHistoryDto.body,
        imageUrl: createNotificationHistoryDto.imageUrl,
        clickAction: createNotificationHistoryDto.clickAction,
        data: createNotificationHistoryDto.data,
        userId: createNotificationHistoryDto.userId,
      };

      const createdRecord = await this.dbServices.notificationHistory.create(historyRecord);
      this.Logger.log(`Created notification history record: ${createdRecord.notificationId}`);

      if (userId) {
        const senderId = createNotificationHistoryDto.data?.senderId;
        const userProfile = await this.dbServices.users.findOne({ userId }, { muteNotifications: 1 });
        if (userProfile?.muteNotifications === true) {
          this.Logger.log(
            `Skipping FCM for userId ${userId}: muteNotifications is enabled (in-app record kept)`
          );
        } else if (senderId && (await this.isSenderMutedByReceiver(userId, senderId))) {
          this.Logger.log(
            `Skipping FCM for userId ${userId}: sender is muted at connection level (in-app record kept)`
          );
        } else {
          await this.sendNotificationToUser(createdRecord);
        }
      }

      return createdRecord;
    } catch (error) {
      this.Logger.error('Error creating notification history record:', error);
      throw error;
    }
  }

  /* Send notification to user's devices */
  private async sendNotificationToUser(notificationRecord: any) {
    try {
      const userId = notificationRecord.userId;
      this.Logger.log(`Looking up device tokens for user: ${userId}`);

      // Find all active device tokens for the user
      const deviceTokens = await this.dbServices.deviceToken.find({
        userId: userId,
        isActive: true
      });
      if (!deviceTokens || deviceTokens.length === 0) {
        this.Logger.warn(`No active device tokens found for user: ${userId}`);
        await this.updateNotificationStatus(notificationRecord.notificationId, NotificationStatus.FAILED);
        return;
      }
      this.Logger.log(`Found ${deviceTokens.length} active device tokens for user: ${userId}`);

      // Generate full CloudFront URL for the image
      const fullImageUrl = this.generateImageUrl(notificationRecord.imageUrl);

      // Prepare notification data
      const notificationData: any = {
        title: notificationRecord.title,
        body: notificationRecord.body,
        clickAction: notificationRecord.clickAction,
        data: {
          ...(notificationRecord.data || {}),
          notificationId: notificationRecord.notificationId,
          userId: userId
        }
      };

      // Only include imageUrl if it's a valid string
      if (fullImageUrl && typeof fullImageUrl === 'string') {
        notificationData.imageUrl = fullImageUrl;
      }

      // Normalize data payload to satisfy Firebase constraint: values must be strings
      const firebaseData = this.normalizeFirebaseDataPayload(notificationData.data);
      // Send notifications to all user's devices
      const results = [];
      for (const deviceToken of deviceTokens) {
        try {
          this.Logger.log(`Sending notification to device: ${deviceToken.deviceTokenId} (${deviceToken.platform})`);

          const result = await this.firebaseService.sendToDevice(
            deviceToken.token,
            notificationData,
            firebaseData
          );

          results.push({
            deviceTokenId: deviceToken.deviceTokenId,
            platform: deviceToken.platform,
            success: true,
            messageId: result
          });

          this.Logger.log(`Successfully sent notification to device ${deviceToken.deviceTokenId}`);
        } catch (deviceError) {
          this.Logger.error(`Failed to send notification to device ${deviceToken.deviceTokenId}:`, deviceError);
          results.push({
            deviceTokenId: deviceToken.deviceTokenId,
            platform: deviceToken.platform,
            success: false,
            error: deviceError.message
          });
        }
      }

      // Update notification status based on results
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      if (successCount === 0 && totalCount > 0) {
        await this.updateNotificationStatus(notificationRecord.notificationId, NotificationStatus.FAILED);
      } else if (successCount > 0 && notificationRecord.status === NotificationStatus.FAILED) {
        await this.updateNotificationStatus(notificationRecord.notificationId, NotificationStatus.UNREAD);
      }

      return {
        notificationId: notificationRecord.notificationId,
        userId: userId,
        totalDevices: totalCount,
        successCount: successCount,
        failureCount: totalCount - successCount,
        results: results
      };

    } catch (error) {
      this.Logger.error('Error sending notification to user:', error);
      await this.updateNotificationStatus(notificationRecord.notificationId, NotificationStatus.FAILED);
      throw error;
    }
  }

  /* Get notification history */
  async getNotificationHistory(skip: number, limit: number, filter: any, nonPaginated: boolean = false) {
    try {
      const result = await this.paginationService.findAndPaginate(this.dbServices.notificationHistory, {
        skip,
        limit,
        filter,
        nonPaginated
      });

      // Transform the items to include full CloudFront URLs for imageUrl
      if (result && result.items) {
        result.items = this.transformNotificationsWithImageUrls(result.items);
      }

      return result;
    } catch (error) {
      this.Logger.error('Error getting notification history:', error);
      throw error;
    }
  }

  /* Get Notification History with Id */
  async getNotificationHistoryWithId(notificationId: string) {
    try {
      const notification = await this.dbServices.notificationHistory.findOne({ notificationId });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      // Transform the notification to include full CloudFront URL for imageUrl
      return this.transformNotificationWithImageUrl(notification);
    } catch (error) {
      this.Logger.error('Error getting notification history with id:', error);
      throw error;
    }
  }

  /* Update Notificaiton status */
  async updateNotificationStatus(notificationId: string, status: NotificationStatus) {
    try {
      const notification = await this.dbServices.notificationHistory.findOneAndUpdate({ notificationId }, { status }, { new: true });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return notification;
    } catch (error) {
      this.Logger.error('Error updating notification status:', error);
      throw error;
    }
  }

  /* Get eh count of notifications by userId */
  async getCountOfNotificationsByUserId(userId: string) {
    try {
      const count = await this.dbServices.notificationHistory.countDocuments({ userId, status: NotificationStatus.UNREAD });
      return { unReadCount: count };
    } catch (error) {
      this.Logger.error('Error getting count of notifications by userId:', error);
      throw error;
    }
  }

  /**
   * Dismiss/clear chat notifications for a user and conversation (ticketId).
   *
   * Contract (chat-service):
   * - Triggers: handleMessageRead (single message viewed) or handleMarkAllRead (mark all read).
   * - Payload: userId (viewer), ticketId (conversation id e.g. CONV-xxx), chatType ('chat'), optional messageIds (chat message _id strings).
   * - If messageIds present: mark only notifications for those messages as READ.
   * - If messageIds absent: mark all notifications for this userId + ticketId as READ.
   *
   * Matching: userId + conversation id in data (ticketId OR conversationId OR roomId) + optional messageId/msgId in messageIds.
   * We do not filter by data.chatType so notifications without that field still match.
   */
  async dismissChatNotifications(payload: DismissNotificationsDto) {
    try {
      const rawUserId = payload.userId?.trim();
      const rawTicketId = payload.ticketId?.trim();
      const { chatType, messageIds } = payload;

      if (!rawUserId || !rawTicketId) {
        throw new BadRequestException('userId and ticketId are required');
      }

      // Conversation id: chat-service sends and stores data.ticketId only; we also match
      // data.conversationId / data.roomId for older or alternate payloads.
      const conversationMatch = {
        $or: [
          { 'data.ticketId': rawTicketId },
          { 'data.conversationId': rawTicketId },
          { 'data.roomId': rawTicketId },
        ],
      };

      const baseFilter: any = {
        userId: rawUserId,
        ...conversationMatch,
      };

      let filter: any = baseFilter;

      if (Array.isArray(messageIds) && messageIds.length > 0) {
        const messageMatch = {
          $or: [
            { 'data.messageId': { $in: messageIds } },
            { 'data.msgId': { $in: messageIds } },
          ],
        };
        filter = {
          userId: rawUserId,
          $and: [conversationMatch, messageMatch],
        };
      }

      const result: any = await this.dbServices.notificationHistory.updateMany(
        filter,
        { status: NotificationStatus.READ }
      );

      const matchedCount = result?.matchedCount ?? result?.n ?? 0;
      const modifiedCount = result?.modifiedCount ?? result?.nModified ?? 0;

      if (matchedCount === 0) {
        this.Logger.warn(
          `Dismiss matched 0 notifications. userId=${rawUserId}, ticketId=${rawTicketId}, messageIdsCount=${messageIds?.length ?? 0}. ` +
          'Check that chat-service dismiss payload ticketId/messageIds match how notifications were created.'
        );
      }

      this.Logger.log(`Dismissed chat notifications for userId=${rawUserId}, ticketId=${rawTicketId}, chatType=${chatType}, messageIdsCount=${messageIds?.length ?? 0}. Matched=${matchedCount}, Modified=${modifiedCount}`);

      return {
        success: true,
        matchedCount,
        modifiedCount,
      };
    } catch (error) {
      this.Logger.error('Error dismissing chat notifications:', error);
      throw error;
    }
  }

  /* Send bulk notifications to multiple tokens */
  async sendBulkNotification(bulkDto: CreateBulkNotificationDto) {
    try {
      this.Logger.log(`Bulk notification request. userIds=${bulkDto.userIds?.length || 0}, tokens=${bulkDto.tokens?.length || 0}`);

      let finalTokens: string[] = bulkDto.tokens || [];

      // 1. If userIds are provided, filter out users with muteNotifications and fetch their active tokens
      if (bulkDto.userIds && bulkDto.userIds.length > 0) {
        const nonMutedUsers = await this.dbServices.users.find(
          { userId: { $in: bulkDto.userIds }, muteNotifications: { $ne: true } },
          { userId: 1 }
        );
        const nonMutedUserIds = nonMutedUsers.map((u: any) => u.userId);
        if (nonMutedUserIds.length < bulkDto.userIds.length) {
          this.Logger.log(`Excluding ${bulkDto.userIds.length - nonMutedUserIds.length} user(s) with muteNotifications from bulk notification`);
        }

        const userTokens = await this.dbServices.deviceToken.find({
          userId: { $in: nonMutedUserIds },
          isActive: true
        });

        const extractedTokens = userTokens.map(t => t.token);
        finalTokens = [...new Set([...finalTokens, ...extractedTokens])];
      }

      // 2. If deviceIds are provided, fetch tokens for those devices
      if (bulkDto.deviceIds && bulkDto.deviceIds.length > 0) {
        const deviceTokens = await this.dbServices.deviceToken.find({
          deviceId: { $in: bulkDto.deviceIds },
          isActive: true
        });

        const extractedTokens = deviceTokens.map(t => t.token);
        finalTokens = [...new Set([...finalTokens, ...extractedTokens])];
      }

      if (finalTokens.length === 0) {
        this.Logger.warn('No tokens found for bulk notification');
        return { successCount: 0, failureCount: 0 };
      }

      this.Logger.log(`Sending bulk notification to ${finalTokens.length} unique devices`);

      // Group invite UI: do not include profile image (expected: no profile needed)
      const isGroupInvite =
        bulkDto.data?.messageType === 'GROUP_INVITE' ||
        bulkDto.data?.requestType === 'GroupInvite';

      // Generate full CloudFront URL for the image (skip for group invites)
      const fullImageUrl = isGroupInvite ? null : this.generateImageUrl(bulkDto.imageUrl);

      // Prepare notification content
      const notificationContent: any = {
        title: bulkDto.title,
        body: bulkDto.body,
        clickAction: bulkDto.clickAction,
      };

      // Only include imageUrl if it's a valid string (never for group invites)
      if (fullImageUrl && typeof fullImageUrl === 'string') {
        notificationContent.imageUrl = fullImageUrl;
      }

      // Normalize data payload to satisfy Firebase constraint: values must be strings
      const firebaseData = this.normalizeFirebaseDataPayload(bulkDto.data);

      // Send notifications via Firebase service
      const result = await this.firebaseService.sendToDevices(
        finalTokens,
        notificationContent,
        firebaseData
      );

      this.Logger.log(`Bulk notification sent. Success: ${result.successCount}, Failure: ${result.failureCount}`);
      return result;
    } catch (error) {
      this.Logger.error('Error sending bulk notification:', error);
      throw error;
    }
  }
}