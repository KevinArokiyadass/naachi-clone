import { IsEnum, IsOptional, IsString, ValidateIf} from 'class-validator';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';
import { AdminRoles } from 'src/common/enums/user.enum';

export class FetchAdminUsersDto extends FetchDto {
  @IsOptional()
  @IsEnum(AdminRoles, { message: 'Invalid admin role' })
  role?: AdminRoles;

  @IsOptional()
  @IsEnum(['active', 'inactive'], { message: 'Status must be active or inactive' })
  status?: 'active' | 'inactive';

  @ValidateIf((o) => o.role === AdminRoles.INSTITUTIONADMIN)
  @IsOptional()
  @IsString()
  institutionsId?: string;

  @IsOptional()
  @IsString()
  departmentsId?: string;
}

