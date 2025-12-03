import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecordStatus } from 'src/common/enums/user.enum';

class EvidenceMessageDto {
  @IsOptional()
  @IsString()
  messageId?: string;
}

export class CreateReviewReportDto {
  @IsString()
  @IsNotEmpty()
  reporterId: string;

  @IsString()
  @IsNotEmpty()
  reportedUserId: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @IsNotEmpty()
  reasonCodeId: string;

  @IsString()
  @IsOptional()
  reasonText?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => EvidenceMessageDto)
  evidenceMessages?: EvidenceMessageDto[];

  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;
}
