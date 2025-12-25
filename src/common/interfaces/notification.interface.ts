import { DeviceType, Platform } from "../enums/device.enum";
import { NotificationStatus } from "../enums/notification.enum";

export interface INotificationManagement {
  notificationId: string;
  title: string;
  body: string;
  imageUrl?: string;
  clickAction?: string;
  data?: Record<string, any>;
  status: NotificationStatus;
  userId: string;
}

export interface IDeviceRegistrationResponse {
  deviceTokenId: string;
  deviceId?: string;
  token: string;
  deviceType: DeviceType;
  platform: Platform;
  userId: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  isActive: boolean;
}