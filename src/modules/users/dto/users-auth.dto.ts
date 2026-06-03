import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { FetchDto } from 'src/common/shared/pagination/dto/fetch.dto';
import { USER_STATUS, UserStatus } from 'src/common/enums/user.enum';

export class UsersSignupDto {
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  referredBy?: string;
}

export class UsersVerifySignupDto {
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @IsNotEmpty({ message: 'OTP is required' })
  @IsString()
  otp: string;

  @IsNotEmpty({ message: 'Session is required' })
  @IsString()
  session: string;
}

export class UsersLoginDto {
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;
}

export class UsersVerifyLoginDto {
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @IsNotEmpty({ message: 'OTP is required' })
  @IsString()
  otp: string;

  @IsNotEmpty({ message: 'Session is required' })
  @IsString()
  session: string;
}

export class UsersRefreshTokenDto {
  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsString()
  refreshToken: string;
}

export class UsersLogoutDto {
  @IsNotEmpty({ message: 'Access token is required' })
  @IsString()
  accessToken: string;

  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsString()
  refreshToken: string;
}

export class UsersGenerateJwtDto {
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString()
  userId: string;
}

export class UsersCheckAvailableUserNameDto {
  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  userName: string;
}

export class SetUsernameDto {
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString()
  userId: string;

  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  userName: string;

  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;
}

const USERNAME_REGEX = /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;

export class ChangeUsernameDto {
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString()
  userId: string;

  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  @Matches(USERNAME_REGEX, {
    message:
      'Username must be 1-30 characters and contain only letters, numbers, underscores, and periods (no consecutive or leading/trailing periods)',
  })
  userName: string;
}

export class VerifyEmailDto {
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString()
  userId: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsNotEmpty({ message: 'Access token is required' })
  @IsString()
  accessToken: string;
}

export class ConfirmEmailDto {
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString()
  userId: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsNotEmpty({ message: 'Confirmation code is required' })
  @IsString()
  confirmationCode: string;

  @IsNotEmpty({ message: 'Access token is required' })
  @IsString()
  accessToken: string;
}

export class GetUsersQueryDto extends FetchDto {
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  institutionsId?: string;

  @IsOptional()
  @IsIn([USER_STATUS.PENDING, USER_STATUS.ACTIVE, USER_STATUS.BLOCKED], { message: 'Status must be pending or active' })
  status?: UserStatus;

  @IsOptional()
  @IsString()
  email?:string;

  @IsOptional()
  @IsString()
  isDeleted?:boolean;

  @IsOptional()
  @IsString()
  departmentsId?: string;
}

export class GetPermissionsQueryDto extends FetchDto {
  @IsNotEmpty({ message: 'Institution ID is required' })
  @IsString()
  institutionsId: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';
}

export class GetUsersByPhoneDto {
  @IsNotEmpty({ message: 'Phone numbers are required' })
  @IsString({ each: true })
  phoneNumbers: string[];

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class ActivateByQrCodeDto {
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString()
  userId: string;

  @IsNotEmpty({ message: 'Referrer User ID is required' })
  @IsString()
  referrerUserId: string;
}

export class ActivateByReferralCodeDto {
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class UnifiedPhoneOtpRequestDto {
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  referredBy?: string;
}

export class UnifiedPhoneOtpVerifyDto {
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @IsNotEmpty({ message: 'OTP is required' })
  @IsString()
  otp: string;

  @IsNotEmpty({ message: 'Session is required' })
  @IsString()
  session: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class FindFriendsDto extends FetchDto {
  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}