import { IsArray, IsOptional, IsString, ArrayNotEmpty } from 'class-validator';

/**
 * DTO used by chat-service to dismiss/clear chat notifications
 * for a given user and conversation (ticketId).
 *
 * - If messageIds is provided: dismiss only those messages.
 * - If messageIds is omitted/empty: dismiss all chat notifications
 *   for the given ticketId for that user.
 */
export class DismissNotificationsDto {
  @IsString()
  userId: string;

  @IsString()
  ticketId: string;

  @IsString()
  chatType: string;

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

