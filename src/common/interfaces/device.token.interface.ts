import { DeviceType, Platform } from "../enums/device.enum";

export interface IDeviceToken {
    deviceTokenId: string;
    token: string;
    deviceType: DeviceType;
    platform: Platform;
    deviceId: string;
    userId: string;
    appVersion?: string;
    deviceModel?: string;
    osVersion?: string;
    isActive: boolean;
}

export interface DeviceTokenResponse {
    deviceTokenId: string;
    token: string;
    deviceType: DeviceType;
    platform: Platform;
    deviceId?: string;
    webDeviceId?: string;
    userId?: string;
    appVersion?: string;
    deviceModel?: string;
    osVersion?: string;
    isActive: boolean;
}