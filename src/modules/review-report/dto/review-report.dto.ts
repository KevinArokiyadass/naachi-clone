import { PartialType } from '@nestjs/mapped-types';
import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsEnum, 
  IsArray, 
  ValidateNested, 
  IsDateString, 
  IsObject 
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReporterDto {
  @IsString()
  @IsNotEmpty()
  id: string; // reporterId

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEnum(['student', 'external', 'teacher', 'admin', 'guest'])
  role: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class ReportedAccountDto {
  @IsString()
  @IsNotEmpty()
  id: string; // reportedUserId

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEnum(['student', 'external', 'teacher', 'admin', 'guest'])
  role: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsEnum(['pending', 'blocked', 'approved', 'legitimate'])
  accountStatus: string;
}

export class EvidenceMessageDto {
  @IsString()
  messageId: string;

  @IsString()
  @IsOptional()
  senderId: string;

  @IsString()
  @IsOptional()
  content: string;

  @IsOptional()
  @IsArray()
  attachments?: { url: string; type: string }[];

  @IsOptional()
  @IsDateString()
  createdAt?: string;
}

export class ReviewReportDto {
  @IsString()
  @IsNotEmpty()
  reasonCode: string;

  @IsOptional()
  @IsString()
  reasonText?: string;

  @ValidateNested()
  @Type(() => ReporterDto)
  reporter: ReporterDto;

  @ValidateNested()
  @Type(() => ReportedAccountDto)
  reportedUser: ReportedAccountDto;

  @IsEnum(['spam', 'scam', 'fake account', 'fraud', 'harassment','porn', 'abuse', 'other'])
  reportType: string;

  @IsEnum(['low', 'medium', 'high', 'critical'])
  severity: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceMessageDto)
  evidenceMessages: EvidenceMessageDto[];

  @IsEnum(['pending', 'in_review', 'resolved', 'rejected'])
  @IsOptional()
  status?: string;

  @IsOptional()
  @IsString()
  moderatorId?: string;

  @IsOptional()
  @IsString()
  resolutionNote?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

export class UpdateReviewReportDto extends PartialType(ReviewReportDto) {}
