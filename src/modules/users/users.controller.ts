import { Body, Controller, Post, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import {
  UsersCheckAvailableUserNameDto,
  UsersGenerateJwtDto,
  UsersLoginDto,
  UsersLogoutDto,
  UsersRefreshTokenDto,
  UsersSignupDto,
  UsersVerifyLoginDto,
  UsersVerifySignupDto
} from './dto/users-auth.dto';
import { UsersPhoneAuthService } from './phone-auth.service';


// @Controller('users-auth')
// export class UsersController {
//   constructor(private readonly usersService: UsersService) {}

//   @Post('verify-phone')
//   async verifyPhone(@Body() dto: VerifyPhoneDto) {
//     return await this.usersService.verifyPhone(dto.phoneNumber);
//   }

//   @Post('confirm-phone')
//   async confirmPhone(@Body()){
//     return await this.usersService.confirmPhone(dto.phoneNumber, dto.otp);
//   }

  // @Post('set-username')
  // async setUsername(@Body()){
  //   return await this.usersService.setUsername(phoneNumber, userName);
  // }

  // @Post('verify-email')
  // async verifyEmail(@Body()) {
  //   return await this.usersService.verifyEmail(dto.phoneNumber, dto.email);
  // }

  // @Post('confirm-email')
  // async confirmEmail(@Body() dto: ConfirmEmailDto) {
  //   return await this.usersService.confirmEmail(dto.email, dto.otp);
  // }

  // @Post('complete-signup')
  // async completeSignup(@Body() dto: CompleteSignupDto) {
  //   return await this.usersService.completeSignup(
  //     dto.phoneNumber,
  //     dto.Name
  //   );
  // }

//   @Get('signup-status/:phoneNumber')
//   async getSignupStatus(@Param('phoneNumber') phoneNumber: string) {
//     return await this.usersService.getSignupStatus(phoneNumber);
//   };

// }

@Controller('users-phone-auth')
export class UsersPhoneAuthController {
  constructor(private readonly phoneAuthService: UsersPhoneAuthService) {}

  @Post('signup')
  async signup(@Body() dto: UsersSignupDto) {
    return this.phoneAuthService.signup(dto);
  }

  @Post('signup/verify')
  async verifySignup(@Body() dto: UsersVerifySignupDto) {
    return this.phoneAuthService.verifySignupOtp(dto);
  }

  @Post('signup/resend-otp')
  async resendSignupOtp(@Body() dto: UsersLoginDto) {
    return this.phoneAuthService.resendSignupOtp(dto.phoneNumber);
  }

  @Post('check-available-Username')
  async checkAvailableUserName(@Body() dto:UsersCheckAvailableUserNameDto){
    return this.phoneAuthService.CheckAvailableUserName(dto.userName)
  }

  @Post('login')
  async requestLogin(@Body() dto: UsersLoginDto) {
    return this.phoneAuthService.requestLoginOtp(dto);
  }

  @Post('login/verify')
  async verifyLogin(@Body() dto: UsersVerifyLoginDto) {
    return this.phoneAuthService.verifyLoginOtp(dto);
  }

  @Post('refresh-token')
  async refreshToken(@Body() dto: UsersRefreshTokenDto) {
    return this.phoneAuthService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: UsersLogoutDto) {
    return this.phoneAuthService.logout(dto.accessToken, dto.refreshToken);
  }

  @Post('generate-jwt')
  async generateJwt(@Body() dto: UsersGenerateJwtDto) {
    return this.phoneAuthService.generateAppJwt(dto.userId);
  }
}


// import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
// import { AuthService } from './auth.service';
// import { SignUpDto, VerifyOtpDto } from './dto/auth.dto';

// @Controller('auth')
// export class AuthController {
//   constructor(private authService: AuthService) { }

//   @Post('create-user')
//   async createUser(
//     @Body('phoneNumber') phoneNumber: string,
//     @Body('name') name: string,
//     @Body('businessName') businessName?: string,
//     @Body('emailId') emailId?: string,
//     @Body('gstNumber') gstNumber?: string,
//     @Body('industryType') industryType?: string,
//     @Body('serviceableArea') serviceableArea?: string
//   ) {
//     const response = await this.authService.createUser(
//       phoneNumber,
//       name,
//       businessName,
//       emailId,
//       gstNumber,
//       industryType,
//       serviceableArea
//     );
//     return response;
//   }

//   @Post('generate-otp')
//   async signInUser(
//     @Body() signUpDto: SignUpDto
//   ) {
//     return await this.authService.signInUser(signUpDto.phoneNumber);
//   }

//   @Post('signin')
//   async signin(
//     @Body() verifyOtpDto: VerifyOtpDto
//   ) {
//     return await this.authService.verifyOTP({
//       phoneNumber: verifyOtpDto.phoneNumber,
//       code: verifyOtpDto.code,
//       session: verifyOtpDto.session
//     });
//   }

//   @Post('refresh-token')
//   async refresh(@Body('refreshToken') refreshToken: string) {
//     return await this.authService.refreshToken({
//       refreshToken: refreshToken
//     });
//   }

//   @Post('logout')
//   async logout(
//     @Body('accessToken') accessToken: string,
//     @Body('refreshToken') refreshToken: string
//   ) {
//     return await this.authService.signOut(accessToken, refreshToken);
//   }

//   @Post('generate-jwt-token')
//   async generateJWTToken(@Body('user') user: string) {
//     return await this.authService.generateJWTToken(user);
//   }
// }
