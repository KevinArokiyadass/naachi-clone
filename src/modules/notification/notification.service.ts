// src/notification/notification.service.ts
import { Injectable } from '@nestjs/common';
import { FirebaseService } from './firebase/firebase.service';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
}

@Injectable()
export class NotificationService {
  constructor(private firebaseService: FirebaseService) {}

  async sendToDevice(token: string, payload: NotificationPayload) {
    return await this.firebaseService.sendToToken(token, payload);
  }

  async publishToTopic(topic: string, payload: NotificationPayload) {
    return await this.firebaseService.sendToTopic(topic, payload);
  }

  async sendToDevices(tokens: string[], payload: NotificationPayload) {
    return await this.firebaseService.sendToTokens(tokens, payload);
  }

  async subscribeToTopic(tokens: string[], topic: string) {
    return await this.firebaseService.subscribeToTopic(tokens, topic);
  }

  async unsubscribeFromTopic(tokens: string[], topic: string) {
    return await this.firebaseService.unsubscribeFromTopic(tokens, topic);
  }
}
