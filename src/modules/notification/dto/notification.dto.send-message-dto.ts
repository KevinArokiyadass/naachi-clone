export class SendMessageDto {
  topic?: string; // or supply tokens instead
  tokens?: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}
