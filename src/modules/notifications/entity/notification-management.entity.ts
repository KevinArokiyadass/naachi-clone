import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { nanoid } from 'nanoid';
import { CollectionNames } from '../../../common/constants/service-common.constants';
import { NotificationStatus } from '../../../common/enums/notification.enum';
import { INotificationManagement } from 'src/common/interfaces/notification.interface';

export type NotificationHistoryDocument = NotificationHistory & Document;

@Schema({ timestamps: true, collection: CollectionNames.NOTIFICATION_HISTORY })
export class NotificationHistory implements INotificationManagement {
  @Prop({ required: true, unique: true, default: () => nanoid(), index: true })
  notificationId: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  body: string;

  @Prop({ type: String, trim: true })
  imageUrl?: string;

  @Prop({ type: String, trim: true, default: 'account' })
  clickAction?: string;

  @Prop({ type: SchemaTypes.Mixed })
  data?: Record<string, any>;

  @Prop({ required: true, enum: NotificationStatus, default: NotificationStatus.UNREAD })
  status: NotificationStatus;

  @Prop({ type: String })
  userId: string;
}
export const NotificationHistorySchema = SchemaFactory.createForClass(NotificationHistory);

NotificationHistorySchema.index({ notificationId: 1 });
NotificationHistorySchema.index({ userId: 1 });