import * as admin from 'firebase-admin';
import { Injectable, Logger } from '@nestjs/common';
import { FirebaseConfig } from '../../common/config/firebase.config';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';
import { chunkArray } from '../../common/helper/firebase.helper';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(
    private readonly firebaseConfig: FirebaseConfig,
    private readonly dbServices: IMongoDBServices
  ) { }


  async sendToDevice(token: string, notification: any, data?: Record<string, string>): Promise<string> {
    try {
      const tokenPreview = `${token.slice(0, 12)}...`;
      this.logger.log(`Sending notification to token=${tokenPreview}`);

      // Build notification object, only including imageUrl if it's a valid string
      const notificationPayload: admin.messaging.Notification = {
        title: notification.title,
        body: notification.body,
      };

      // Only include imageUrl if it's a valid string
      if (notification.imageUrl && typeof notification.imageUrl === 'string') {
        notificationPayload.imageUrl = notification.imageUrl;
      }

      // Consistent payload for all platforms, Firebase handles the selection
      const message: admin.messaging.Message = {
        token,
        notification: notificationPayload,
        data,
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'default' },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1, // Added badge consistency
            },
          },
        },
        webpush: {
          notification: {
            icon: '/icon.png',
            badge: '/badge.png',
          },
          fcmOptions: {
            link: notification.clickAction || '/',
          },
        },
      };

      const messaging = await this.firebaseConfig.getMessaging();
      const response = await messaging.send(message);
      this.logger.log(`Message sent: ${response}`);
      return response;
    } catch (err: any) {
      this.logger.error('sendToDevice failed', err as any);

      // Cleanup token if invalid
      const errorMessage = err.message || '';
      if (errorMessage.includes('not-registered') || errorMessage.includes('invalid-registration-token')) {
        this.logger.warn(`Removing invalid token during single send: ${token.slice(0, 12)}...`);
        await this.dbServices.deviceToken.updateMany({ token: { $eq: token } }, { isActive: false });
      }

      throw err;
    }
  }

  async sendToDevices(
    tokens: string[],
    notification: any,
    data?: Record<string, string>
  ): Promise<{ successCount: number; failureCount: number }> {
    const messaging = await this.firebaseConfig.getMessaging();

    let successCount = 0;
    let failureCount = 0;

    const tokenChunks = chunkArray(tokens, 500);

    for (const chunk of tokenChunks) {
      // Build notification object, only including imageUrl if it's a valid string
      const notificationPayload: admin.messaging.Notification = {
        title: notification.title,
        body: notification.body,
      };

      // Only include imageUrl if it's a valid string
      if (notification.imageUrl && typeof notification.imageUrl === 'string') {
        notificationPayload.imageUrl = notification.imageUrl;
      }

      const message: admin.messaging.MulticastMessage = {
        tokens: chunk,
        notification: notificationPayload,
        data,
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'default' },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1, // Added badge consistency
            },
          },
        },
        webpush: {
          notification: {
            icon: '/icon.png',
            badge: '/badge.png',
          },
          fcmOptions: {
            link: notification.clickAction || '/',
          },
        },
      };

      const response = await messaging.sendEachForMulticast(message);

      successCount += response.successCount;
      failureCount += response.failureCount;

      // Automated Cleanup of invalid tokens
      const invalidTokens = [];
      response.responses.forEach((res, index) => {
        if (!res.success) {
          const error = res.error as any;
          if (error?.code === 'messaging/registration-token-not-registered' ||
            error?.code === 'messaging/invalid-registration-token') {
            invalidTokens.push(chunk[index]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        this.logger.warn(`Deactivating ${invalidTokens.length} invalid tokens found during bulk send.`);
        await this.dbServices.deviceToken.updateMany(
          { token: { $in: invalidTokens } },
          { isActive: false }
        );
      }
    }

    this.logger.log(
      `Bulk notification done. success=${successCount} failure=${failureCount}`
    );

    return { successCount, failureCount };
  }

  /**
   * Validate FCM token and deactivate if invalid
   */
  async validateToken(token: string, userId: string): Promise<{ isValid: boolean; error?: string; deactivated?: boolean }> {
    try {
      this.logger.log(`Validating token: ${token.slice(0, 12)}...`);

      // Try to send a test message to validate the token
      const testMessage: admin.messaging.Message = {
        token,
        data: {
          test: 'validation',
          timestamp: Date.now().toString()
        },
        // Use data-only message for validation (no notification)
        android: { priority: 'normal' },
        apns: { payload: { aps: { contentAvailable: true } } },
        webpush: { data: { test: 'validation' } }
      };

      const messaging = await this.firebaseConfig.getMessaging();
      await messaging.send(testMessage);

      this.logger.log(`Token validation successful: ${token.slice(0, 12)}...`);
      return { isValid: true };

    } catch (error: any) {
      this.logger.error(`Token validation failed: ${token.slice(0, 12)}...`, error);

      // Check if it's a token-related error
      const errorMessage = error.message || error.toString();
      const isTokenError = errorMessage.includes('invalid-registration-token') ||
        errorMessage.includes('registration-token-not-registered') ||
        errorMessage.includes('invalid-argument') ||
        errorMessage.includes('messaging/invalid-registration-token') ||
        errorMessage.includes('messaging/registration-token-not-registered');

      if (isTokenError) {
        // Deactivate the token in database
        await this.dbServices.deviceToken.findOneAndUpdate({ token, userId }, { isActive: false });
        return {
          isValid: false,
          error: errorMessage,
          deactivated: true
        };
      }

      return {
        isValid: false,
        error: errorMessage,
        deactivated: false
      };
    }
  }
}
