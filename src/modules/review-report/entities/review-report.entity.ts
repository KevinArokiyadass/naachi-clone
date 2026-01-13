import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RecordStatus } from 'src/common/enums/user.enum';
import { generateUniqueId } from 'src/common/utils/util';
import { Types } from 'mongoose';

export type Report = ReviewReport & Document;

@Schema({ timestamps: true })

export class ReviewReport extends Document{
  @Prop({ type: Types.ObjectId, ref: 'Users', required: true, index: true })
  reporterId: string;

  @Prop({ type: Types.ObjectId, ref: 'Users', required: true, index: true })
  reportedUserId: string;

  @Prop({ type: String, ref: 'Conversation', index: true })
  conversationId?: string;

  @Prop({ type: String, required: true })
  reasonCodeId: string;

  @Prop({ type: String, required: false })
  reasonText?: string;
  @Prop({ type: String, default: () => generateUniqueId(), required: true, trim: true, unique: true })
  reviewId: string;

  @Prop({
    type: [
      {
        messageId: { type: String, required: true },
        content: { type: String, required: false },
        senderId: { type: String, required: false },
        createdAt: { type: String, required: false },
        _id: false  
      }
    ],
    default: []
  })
  evidenceMessages?: {
    messageId: string;
    content?: string;
    senderId?: string;
    createdAt?: string;
  }[];
  @Prop({
    type: String,
    enum: Object.values(RecordStatus),
    default: RecordStatus.PENDING
  })
  status: RecordStatus;
}
export const ReviewReportSchema = SchemaFactory.createForClass(ReviewReport);
