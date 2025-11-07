import { PartialType } from '@nestjs/mapped-types';
import { CreateAwsStoreDto } from './create-aws-store.dto';

export class UpdateAwsStoreDto extends PartialType(CreateAwsStoreDto) {}
