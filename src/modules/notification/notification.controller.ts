import { Controller, Post, Body, Get } from '@nestjs/common';
import {
  NotificationService,
  NotificationPayload,
} from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Post('send-to-device')
  async sendToDevice(
    @Body() body: { token: string; payload: NotificationPayload },
  ) {
    try {
      const result = await this.notificationService.sendToDevice(
        body.token,
        body.payload,
      );
      return { success: true, messageId: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('publish-to-topic')
  async publishToTopic(
    @Body() body: { topic: string; payload: NotificationPayload },
  ) {
    try {
      const result = await this.notificationService.publishToTopic(
        body.topic,
        body.payload,
      );
      return { success: true, messageId: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('send-to-devices')
  async sendToDevices(
    @Body() body: { tokens: string[]; payload: NotificationPayload },
  ) {
    try {
      const result = await this.notificationService.sendToDevices(
        body.tokens,
        body.payload,
      );
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  @Post('subscribe-to-topic')
  async subscribeToTopic(@Body() body: { tokens: string[]; topic: string }) {
    try {
      const result = await this.notificationService.subscribeToTopic(
        body.tokens,
        body.topic,
      );
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('unsubscribe-from-topic')
  async unsubscribeFromTopic(
    @Body() body: { tokens: string[]; topic: string },
  ) {
    try {
      const result = await this.notificationService.unsubscribeFromTopic(
        body.tokens,
        body.topic,
      );
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('health')
  healthCheck() {
    return { status: 'OK', timestamp: new Date().toISOString() };
  }
}
