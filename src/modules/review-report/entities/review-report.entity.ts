import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';
import { RecordStatus } from 'src/common/enums/user.enum';

export type Report = ReviewReport & Document;

@Schema({ timestamps: true })

export class ReviewReport extends Document{
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  reporterId: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  reportedUserId: string;

  @Prop({type:SchemaTypes.ObjectId, ref: 'Conversation', index: true })
  conversationId?: string;

  @Prop({ type: String, required: true })
  reasonCodeId: string;

  @Prop({ type: String, required: false })
  reasonText?: string;
  
  @Prop({ type: String, required: true })
  reviewId: string;
  
  @Prop({
    type: [{
      messageId: { type: SchemaTypes.ObjectId }
    }],
    default: []
  })
  evidenceMessages?: { messageId: string }[];

  @Prop({
    type: String,
    enum: Object.values(RecordStatus),
    default: RecordStatus.PENDING
  })
  status: RecordStatus;
}
export const ReviewReportSchema = SchemaFactory.createForClass(ReviewReport);
