import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';

export class GetPermissionsQueryDto extends FetchDto {
  @IsOptional()
  @IsString()
  institutionsId: string;

  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';
}

