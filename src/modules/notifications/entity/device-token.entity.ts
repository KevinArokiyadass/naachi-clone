import { nanoid } from 'nanoid';
import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DeviceType, Platform } from 'src/common/enums/device.enum';
import { IDeviceToken } from "../../../common/interfaces/device.token.interface";

export type DeviceTokenDocument = DeviceToken & Document;

@Schema({ timestamps: true, collection: 'devicetokens' })
export class DeviceToken extends Document implements IDeviceToken {
  @Prop({ required: true, unique: true, default: () => nanoid() })
  deviceTokenId: string;

  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ required: true, enum: DeviceType })
  deviceType: DeviceType;

  @Prop({ required: true, enum: Platform })
  platform: Platform;

  @Prop({ sparse: true, index: true })
  deviceId: string;

  @Prop({ required: true })
  userId: string;

  @Prop()
  appVersion?: string;

  @Prop()
  deviceModel?: string;

  @Prop()
  osVersion?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceToken);

// Create compound indexes for efficient queries
DeviceTokenSchema.index({ userId: 1, isActive: 1 });
DeviceTokenSchema.index({ deviceType: 1, isActive: 1 });
DeviceTokenSchema.index({ platform: 1, isActive: 1 });
DeviceTokenSchema.index({ deviceId: 1, isActive: 1 });
DeviceTokenSchema.index({ userId: 1, deviceType: 1, isActive: 1 });
DeviceTokenSchema.index({ userId: 1, platform: 1, isActive: 1 });

// TTL index to automatically remove inactive tokens after 1 year
DeviceTokenSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
