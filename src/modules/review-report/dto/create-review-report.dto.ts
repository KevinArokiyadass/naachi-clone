import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecordStatus } from 'src/common/enums/user.enum';

class EvidenceMessageDto {
  @IsMongoId()
  @IsNotEmpty()
  messageId: string;
}

export class CreateReviewReportDto {
  @IsMongoId()
  @IsNotEmpty()
  reporterId: string;

  @IsMongoId()
  @IsNotEmpty()
  reportedUserId: string;

  @IsMongoId()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsNotEmpty()
  reasonCodeId: string;

  @IsString()
  @IsOptional()
  reasonText?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceMessageDto)
  @IsOptional()
  evidenceMessages?: EvidenceMessageDto[];

  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;

  @IsString()
  @IsNotEmpty()
  reviewId: string;
}
