import { IsArray, IsOptional, IsString, ArrayNotEmpty } from 'class-validator';

/**
 * DTO for POST /notifications/dismiss (chat-service → user-service).
 *
 * Chat-service sends: userId (viewer), ticketId (conversation id e.g. CONV-xxx), chatType: 'chat',
 * and optionally messageIds (chat message _id strings). If messageIds omitted → dismiss all for userId + ticketId.
 */
export class DismissNotificationsDto {
  @IsString()
  userId: string;

  @IsString()
  ticketId: string;

  @IsOptional()
  @IsString()
  chatType?: string;

  /**
   * Optional list of message IDs for which to dismiss notifications.
   * When omitted or empty, all chat notifications for this ticketId
   * will be dismissed.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  messageIds?: string[];
}

