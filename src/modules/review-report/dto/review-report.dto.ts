import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, ValidateNested, IsDateString, IsEmpty, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class ReporterDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    role: string;

    @IsOptional()
    @IsNotEmpty()
    avatar?: string;

    @IsEnum(['student', 'teacher', 'external', 'guest', 'admin'])
    issuedBy: 'student' | 'external' | 'teacher' | 'admin' | 'guest';
}

class ReportedAccountDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    role: string;

    @IsOptional()
    @IsNotEmpty()
    avatar?: string;

    @IsEnum(['pending', 'blocked', 'approved', 'legitimate'])
    accountStatus: 'pending' | 'blocked' | 'approved' | 'legitimate';

}

class ChatMessageDto {
    @IsString()
    sender: string;

    @IsString()
    text: string;

    @IsDateString()
    timestamp: Date;
}

export class ReviewReportDto {
    @IsString()
    @IsNotEmpty()
    date: string;

    @ValidateNested()
    @Type(() => ReportedAccountDto)
    accReported: ReportedAccountDto;

    @IsObject()
    reportedBy: any;

    @IsString()
    @IsNotEmpty()
    comment: string;

    @IsEnum(['spam', 'scam', 'fake account', 'abuse', 'other'])
    reportType: string;

    @IsEnum(['low', 'medium', 'high'])
    severity: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ChatMessageDto)
    lastMessage: ChatMessageDto[]; 

    @IsOptional()
    isReviewed?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    attachment?: string[];  

    @IsOptional()
    @IsString()
    platform?: string;

    @IsOptional()
    @IsString()
    ipAddress?: string;

    @IsOptional()
    @IsString()
    deviceInfo?: string;
}
export class UpdateReviewReportDto extends PartialType(ReviewReportDto) {}
