import { Body, Controller, Post, Get, Param, Query, Patch, Put, BadRequestException } from '@nestjs/common';
import {
  ActivateByQrCodeDto,
  ConfirmEmailDto,
  FindFriendsDto,
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
  VerifyEmailDto,
  UnifiedPhoneOtpRequestDto,
  UnifiedPhoneOtpVerifyDto,
} from './dto/users-auth.dto';
import { UpdateUserProfileDto } from './dto/user-profile.dto';
import { UsersAuthService } from './users.service';
import { RecordService } from "@noukha-technologies/mdm-core"
import { USER_STATUS } from 'src/common/enums/user.enum';


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersAuthService) { }


  @Post('phn-otp/request')
  async requestPhnOtp(@Body() dto: UnifiedPhoneOtpRequestDto) {
    return this.usersService.requestUnifiedPhoneOtp(dto);
  }

  @Post('phn-otp/verify')
  async verifyPhnOtp(@Body() dto: UnifiedPhoneOtpVerifyDto) {
    return this.usersService.verifyUnifiedPhoneOtp(dto);
  }

  @Post('phn-otp/resend')
  async resendPhnOtp(@Body() dto: UnifiedPhoneOtpRequestDto) {
    return this.usersService.resendUnifiedPhoneOtp(dto);
  }

  // @Post('signup')
  // async signup(@Body() dto: UsersSignupDto) {
  //   return this.usersService.signup(dto);
  // }

  // @Post('signup/verify')
  // async verifySignup(@Body() dto: UsersVerifySignupDto) { 
  //   return this.usersService.verifySignupOtp(dto);
  // }

  // @Post('signup/resend-otp')
  // async resendSignupOtp(@Body() dto: UsersLoginDto) {
  //   return this.usersService.resendSignupOtp(dto.phoneNumber);
  // }

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

  // @Post('login')
  // async requestLogin(@Body() dto: UsersLoginDto) {  
  //   return this.usersService.requestLoginOtp(dto);
  // }

  // @Post('login/verify')
  // async verifyLogin(@Body() dto: UsersVerifyLoginDto) { 
  //   return this.usersService.verifyLoginOtp(dto);
  // }


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
    const { skip, limit, nonPaginated, phoneNumber, userName,email, userId, institutionsId, search, status, isDeleted } = query;
    const filter: Record<string, any> = {};
    if (isDeleted !== undefined) {
          filter.isDeleted = isDeleted;
    }
    // Filter by status if provided, otherwise default to 'active' for backward compatibility
    if (status) {
      filter.status = status;
    } else if (!isDeleted){
      filter.status = USER_STATUS.ACTIVE;  
    }

    if (search) {
      // When search is provided, search across user-facing fields (excluding userId)
      filter.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
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
      if (email) {
        filter.email = { $regex: email, $options: 'i' };
      }
    }

    if (institutionsId) {
      filter.institutionsId = institutionsId;
    }

    return this.usersService.findAllUsers(skip, limit, filter, nonPaginated);
  }


  @Post('users-by-phone')
  getUsersByPhone(@Body() dto: GetUsersByPhoneDto) {
    return this.usersService.getUsersByPhoneNumbers(
      dto.phoneNumbers,
      dto.ownerId,
    );
  }

  @Post('activate-by-qr-code')
  async activateByQrCode(@Body() dto: ActivateByQrCodeDto) {
    return this.usersService.activateByQrCode(dto.userId, dto.referrerUserId);
  }

  @Get('find-friends')
  async findFriends(@Query() query: FindFriendsDto) {
    const { skip, limit, nonPaginated, ownerId, userId, search } = query;
    const requesterId = ownerId || userId;
    
    if (!requesterId) {
      throw new BadRequestException('Either ownerId or userId is required');
    }

    return this.usersService.findFriends(requesterId, skip, limit, nonPaginated, search);
  }

  @Get('all-friends')
  async findAllFriends(@Query() query: FindFriendsDto) {
    const { skip, limit, nonPaginated, ownerId, userId, search } = query;
    const requesterId = ownerId || userId;

    if (!requesterId) {
      throw new BadRequestException('Either ownerId or userId is required');
    }

    return this.usersService.findAllFriends(
      requesterId,
      skip,
      limit,
      nonPaginated,
      search,
    );
  }

  @Get(':userId')
  async getUserByUserId(@Param('userId') userId: string) {
    return this.usersService.getUserByUserId(userId);
  }

  @Patch(':userId')
  async updateUserProfile(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateUserProfile(userId, dto);
  }

  @Patch(':userId/delete-user')
  async deleteUser(
    @Param('userId') userId: string, 
    @Body()dto: {isDeleted: boolean}
  )
  {
      return this.usersService.deleteUser(userId,dto.isDeleted);
  }
}
