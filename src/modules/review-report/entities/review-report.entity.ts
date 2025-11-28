import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const UserRoleEnum = ['student', 'external', 'teacher', 'admin', 'guest'] as const;
export const AccountStatusEnum = ['pending', 'blocked', 'approved', 'legitimate'] as const;
export const ReportTypeEnum = ['spam', 'scam', 'fake account', 'abuse', 'other'] as const;
export const SeverityEnum = ['low', 'medium', 'high'] as const;

// Common user fields
const CommonUserFields = {
  name: String,
  username: String,
  role: String,
  avatar: String,
};

// Reporter sub-schema
const ReporterSchema = {
  ...CommonUserFields,
  issueBy: {
    type: String,
    enum: UserRoleEnum,
    default: 'external',
  },
};

// Reported Account sub-schema
const ReportedAccountSchema = {
  ...CommonUserFields,
  accountStatus: {
    type: String,
    enum: AccountStatusEnum,
    default: 'pending',
  },
};

// Chat message sub-schema
const ChatMessageSchema = {
  sender: String,
  text: String,
  timestamp: Date,
};

// Admin reviewer sub-schema
const ReviewedBySchema = {
  adminId: String,
  name: String,
};

@Schema({ timestamps: true })
export class ReviewReport extends Document {
  @Prop()
  date: string;

  @Prop({ type: ReporterSchema, required: true })
  reportedBy: typeof ReporterSchema;

  @Prop({ type: ReportedAccountSchema, required: true })
  accReported: typeof ReportedAccountSchema;

  @Prop({ required: true })
  comment: string;

  @Prop({
    type: String,
    enum: ReportTypeEnum,
    default: 'other',
  })
  reportType: string;

  @Prop({
    type: String,
    enum: SeverityEnum,
    default: 'low',
  })
  severity: string;

  @Prop({ type: [ChatMessageSchema], default: [] })
  lastMessage: typeof ChatMessageSchema[];

  @Prop({ default: false })
  isReviewed: boolean;

  @Prop({ type: ReviewedBySchema, default: null })
  reviewedBy?: typeof ReviewedBySchema;

  @Prop({ type: [String], default: [] })
  attachment: string[];

  @Prop()
  platform: string;

  @Prop()
  ipAddress: string;

  @Prop()
  deviceInfo: string;
}

export const ReviewReportSchema = SchemaFactory.createForClass(ReviewReport);
