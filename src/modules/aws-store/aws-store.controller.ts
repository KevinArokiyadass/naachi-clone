import { Controller, Post, Get, Body } from '@nestjs/common';
import { AwsStoreService } from './aws-store.service';

@Controller('aws-store')
export class AwsStoreController {
  constructor(private readonly awsStoreService: AwsStoreService) { }

  @Post('upload-url')
  async getUploadUrl(
    @Body() { fileName, contentType }: { fileName: string; contentType: string },
  ) {
    return this.awsStoreService.generatePresignedUrl(fileName, contentType);
  }

  @Post('file-url')
  async getFileUrl(@Body() { s3FileName }: { s3FileName: string }) {
    const fileUrl = this.awsStoreService.getCloudFrontUrl(s3FileName);
    return { fileUrl };
  }
}