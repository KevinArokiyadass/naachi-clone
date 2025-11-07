import { Module } from '@nestjs/common';
import { AwsStoreService } from './aws-store.service';
import { AwsStoreController } from './aws-store.controller';

@Module({
  controllers: [AwsStoreController],
  providers: [AwsStoreService],
  exports: [AwsStoreService],
})
export class AwsStoreModule { }
