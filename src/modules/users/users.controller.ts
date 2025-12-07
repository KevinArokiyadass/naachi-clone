import { Body, Controller, Post, Get, Param, Query } from '@nestjs/common';
import {
  ActivateByQrCodeDto,
  ConfirmEmailDto,
  GetUsersByPhoneDto,
  GetPermissionsQueryDto,
  GetUsersQueryDto,
  SetUsernameDto,
  UsersCheckAvailableUserNameDto,
  UsersGenerateJwtDto,
  UsersLoginDto,
  UsersLogoutDto,
  UsersRefreshTokenDto,
  UsersSignupDto,
  UsersVerifyLoginDto,
  UsersVerifySignupDto,
  VerifyEmailDto
} from './dto/users-auth.dto';
import { UsersAuthService } from './users.service';
import {RecordService} from "@noukha-technologies/mdm-core"


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersAuthService) {}

  @Post('signup')
  async signup(@Body() dto: UsersSignupDto) {
    return this.usersService.signup(dto);
  }

  @Post('signup/verify')
  async verifySignup(@Body() dto: UsersVerifySignupDto) { 
    return this.usersService.verifySignupOtp(dto);
  }

  @Post('signup/resend-otp')
  async resendSignupOtp(@Body() dto: UsersLoginDto) {
    return this.usersService.resendSignupOtp(dto.phoneNumber);
  }

  @Post('check-available-username')
  async checkAvailableUserName(@Body() dto: UsersCheckAvailableUserNameDto) {
    return this.usersService.checkAvailableUserName(dto.userName);
  }

  @Post('set-username')
  async setUsername(@Body() dto: SetUsernameDto) {
    return this.usersService.setUsername(dto);
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.usersService.verifyEmail(dto);
  }

  @Post('confirm-email')
  async confirmEmail(@Body() dto: ConfirmEmailDto) {  
    return this.usersService.confirmEmail(dto);
  }

  @Post('login')
  async requestLogin(@Body() dto: UsersLoginDto) {  
    return this.usersService.requestLoginOtp(dto);
  }

  @Post('login/verify')
  async verifyLogin(@Body() dto: UsersVerifyLoginDto) { 
    return this.usersService.verifyLoginOtp(dto);
  }

  @Post('refresh-token')
  async refreshToken(@Body() dto: UsersRefreshTokenDto) {
    return this.usersService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: UsersLogoutDto) {
    return this.usersService.logout(dto.accessToken, dto.refreshToken);
  }

  @Post('generate-jwt')
  async generateJwt(@Body() dto: UsersGenerateJwtDto) {
    return this.usersService.generateAppJwt(dto.userId);
  }

  @Get()
  getAllUsers(@Query() query: GetUsersQueryDto) {
    const { skip, limit, nonPaginated, phoneNumber, userName, userId, search } = query;

    const filter: Record<string, any> = {};

    filter.status = 'completed';

    if (search) {
      // When search is provided, search across all relevant fields
      filter.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    } else {
      // When search is not provided, use individual field filters
      if (phoneNumber) {
        filter.phoneNumber = { $regex: phoneNumber, $options: 'i' };
      }

      if (userName) {
        filter.userName = { $regex: userName, $options: 'i' };
      }

      if (userId) {
        filter.userId = { $regex: userId, $options: 'i' };
      }
    }

    return this.usersService.findAllUsers(skip, limit, filter, nonPaginated);
  }


  @Post('Users-by-phone')
  getUsersByPhone(@Body() dto: GetUsersByPhoneDto) {
    return this.usersService.getUsersByPhoneNumbers(dto.phoneNumbers);
  }

  @Post('activate-by-qr-code')
  async activateByQrCode(@Body() dto: ActivateByQrCodeDto) {
    return this.usersService.activateByQrCode(dto.userId, dto.referrerUserId);
  }
}


