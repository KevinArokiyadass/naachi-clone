import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RecordStatus } from 'src/common/enums/user.enum';
import { generateUniqueId } from 'src/common/utils/util';

export type Report = ReviewReport & Document;

@Schema({ timestamps: true })

export class ReviewReport extends Document{
  @Prop({ type: String, ref: 'User', required: true, index: true })
  reporterId: string;

  @Prop({ type: String, ref: 'User', required: true, index: true })
  reportedUserId: string;

  @Prop({ type: String, ref: 'Conversation', index: true })
  conversationId?: string;

  @Prop({ type: String, required: true })
  reasonCodeId: string;

  @Prop({ type: String, required: false })
  reasonText?: string;
  
  @Prop({ type: String, default: () => generateUniqueId(), required: true, trim: true })
  reviewId: string;

  @Prop({
    type: [
      {
        messageId: { type: String, default: () => generateUniqueId() }, // auto nanoid
      }
    ],
    default: []
  })
  evidenceMessages?: { messageId: string; content: string }[];

  @Prop({
    type: String,
    enum: Object.values(RecordStatus),
    default: RecordStatus.PENDING
  })
  status: RecordStatus;
}
export const ReviewReportSchema = SchemaFactory.createForClass(ReviewReport);
