import * as admin from 'firebase-admin';
import { Injectable, Logger } from '@nestjs/common';
import { FirebaseConfig } from '../../common/config/firebase.config';
import { IMongoDBServices } from '../../common/repository/mongodb-repository/abstract.repository';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(
    private readonly firebaseConfig: FirebaseConfig,
    private readonly dbServices: IMongoDBServices
  ) { }

  private detectTokenPlatform(token: string): 'web' | 'android' | 'ios' | 'unknown' {
    // Heuristics:
    // - Android tokens usually contain ':APA91' (older/newish)
    // - iOS APNs device tokens are often 64 hex chars (no colon)
    // - Web tokens are longer (>100) and usually don't contain colon patterns.
    if (!token) return 'unknown';

    const preview = `${token.slice(0, 12)}...`;
    this.logger.log(`Detecting platform for token: ${preview} (len=${token.length})`);

    if (token.includes(':APA91')) return 'android';

    // iOS APNs device tokens are typically 64 hex chars (no ':') — heuristic
    const isLikelyIos = /^[0-9a-fA-F]{64}$/.test(token);
    if (isLikelyIos) return 'ios';

    // Web tokens are usually long and do not contain the ':APA91' pattern
    if (token.length > 100 && !token.includes(':')) return 'web';

    // Fallback: unknown
    return 'unknown';
  }

  async sendToDevice(token: string, notification: any, data?: Record<string, string>): Promise<string> {
    try {
      const platform = this.detectTokenPlatform(token);
      const tokenPreview = `${token.slice(0, 12)}...`;
      this.logger.log(`Sending notification to platform=${platform} token=${tokenPreview}`);

      let message: admin.messaging.Message;

      if (platform === 'android') {
        message = {
          token,
          notification: { title: notification.title, body: notification.body, imageUrl: notification.imageUrl },
          data,
          android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
        };
      } else if (platform === 'ios') {
        message = {
          token,
          notification: { title: notification.title, body: notification.body, imageUrl: notification.imageUrl },
          data,
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        };
      } else if (platform === 'web') {
        message = {
          token,
          notification: { title: notification.title, body: notification.body, imageUrl: notification.imageUrl },
          data,
          webpush: {
            notification: { icon: '/icon.png', badge: '/badge.png' },
            fcmOptions: {
              link: notification.clickAction || '/'
            }
          },
        };
      } else {
        this.logger.warn('Unknown token platform; sending data-only message as fallback');
        message = {
          token,
          data: {
            title: notification.title || '',
            body: notification.body || '',
            ...(data || {})
          },
        };
      }

      const messaging = await this.firebaseConfig.getMessaging();
      const response = await messaging.send(message);
      this.logger.log(`Message sent: ${response}`);
      return response;
    } catch (err) {
      this.logger.error('sendToDevice failed', err as any);
      throw err;
    }
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
