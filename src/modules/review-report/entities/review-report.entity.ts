import { Schema, Document } from 'mongoose';

export const UserRoleEnum = ['student', 'external', 'teacher', 'admin', 'guest'] as const;
export const AccountStatusEnum = ['pending', 'blocked', 'approved', 'legitimate'] as const;
export const ReportTypeEnum = ['spam', 'scam', 'fake account','harassment','porn','fraud', 'abuse', 'other'] as const;
export const SeverityEnum = ['low', 'medium', 'high', 'critical'] as const;

export const ReportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    reportedUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },

    reasonCode: { type: String, required: true },
    reasonText: { type: String },

    evidenceMessages: [
      {
        messageId: { type: Schema.Types.ObjectId },
        senderId: { type: Schema.Types.ObjectId, ref: 'User' },
        content: { type: String },
        attachments: [
          {
            url: { type: String },
            type: { type: String }
          }
        ],
        createdAt: { type: Date },
      },
    ],

    status: {
      type: String,
      enum: ['pending', 'in_review', 'resolved', 'rejected'],
      default: 'pending',
    },

    moderatorId: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: { type: String },

    reportType: { type: String, enum: ReportTypeEnum, required: true },
    severity: { type: String, enum: SeverityEnum, default: 'low' },

    isAnonymous: { type: Boolean, default: false },

    ipAddress: { type: String },
    deviceInfo: { type: String },
    platform: { type: String },
  },
  { timestamps: true }
);

export class ReviewReport extends Document {}

export { ReportSchema as ReviewReportSchema };
