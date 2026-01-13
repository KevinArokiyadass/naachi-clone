export interface IReviewReport {
    _id?: string;
    reporterId: string;
    reportedUserId: string;
    conversationId?: string;
    reasonCodeId: string;
    reasonText: string;
    reviewId: string;
    evidenceMessages?: {
      messageId: string;
      content: string;
      senderId: string;
      createdAt: string;
      _id?: string;
    }[];
    status: 'PENDING' | 'RESOLVED' | 'BLOCKED'; 
    createdAt?: Date;
    updatedAt?: Date;
  }
  