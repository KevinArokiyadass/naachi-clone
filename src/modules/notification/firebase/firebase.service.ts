import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  constructor(@Inject('FIREBASE_MESSAGING') private readonly messaging: admin.messaging.Messaging) {}

  onModuleInit() {
    try {
      // No-op: app initialization is now handled by providers in FirebaseModule
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Firebase Admin SDK:',
        error.message,
      );
      throw error;
    }
  }

  getMessaging() {
    return this.messaging;
  }

  async sendToToken(token: string, payload: any) {
    if (!payload?.title || !payload?.body) {
      throw new Error('Payload must contain title and body');
    }

    if (!token || token.trim() === '') {
      throw new Error('Device token is required and cannot be empty');
    }

    const message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    };

    try {
      const response = await this.getMessaging().send(message);
      this.logger.log(`Push notification sent successfully to token: ${token.substring(0, 10)}...`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to send push notification to token: ${token.substring(0, 10)}...`, error.message);
      this.logger.error('Full error details:', error);
      throw error;
    }
  }

  async sendToTopic(topic: string, payload: any) {
    if (!payload?.title || !payload?.body) {
      throw new Error('Payload must contain title and body');
    }

    const message = {
      topic,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    };

    const response = await this.getMessaging().send(message);
    return response;
  }

  async sendToTokens(tokens: string[], payload: any) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw new Error('Tokens array must not be empty');
    }
    if (!payload?.title || !payload?.body) {
      throw new Error('Payload must contain title and body');
    }

    const message = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    };

    const response = await this.getMessaging().sendEachForMulticast(message);
    return response;
  }

  async subscribeToTopic(tokens: string[], topic: string) {
    const response = await this.getMessaging().subscribeToTopic(
      tokens,
      topic,
    );
    return response;
  }

  async unsubscribeFromTopic(tokens: string[], topic: string) {
    const response = await this.getMessaging().unsubscribeFromTopic(
      tokens,
      topic,
    );
    return response;
  }
}
