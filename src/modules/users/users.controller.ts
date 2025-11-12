import { Body, Controller, Post, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import {
  VerifyPhoneDto,
  ConfirmPhoneDto,
  SetUsernameDto,
  VerifyEmailDto,
  ConfirmEmailDto,
  CompleteSignupDto
} from './dto/multistep-signup.dto';


@Controller('users-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('verify-phone')
  async verifyPhone(@Body() dto: VerifyPhoneDto) {
    return await this.usersService.verifyPhone(dto.phoneNumber);
  }

  @Post('confirm-phone')
  async confirmPhone(@Body() dto: ConfirmPhoneDto) {
    return await this.usersService.confirmPhone(dto.phoneNumber, dto.otp);
  }

  @Post('set-username')
  async setUsername(@Body() dto: SetUsernameDto) {
    return await this.usersService.setUsername(dto.phoneNumber, dto.userName);
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return await this.usersService.verifyEmail(dto.phoneNumber, dto.email);
  }

  @Post('confirm-email')
  async confirmEmail(@Body() dto: ConfirmEmailDto) {
    return await this.usersService.confirmEmail(dto.email, dto.otp);
  }

  @Post('complete-signup')
  async completeSignup(@Body() dto: CompleteSignupDto) {
    return await this.usersService.completeSignup(
      dto.phoneNumber,
      dto.Name
    );
  }

  @Get('signup-status/:phoneNumber')
  async getSignupStatus(@Param('phoneNumber') phoneNumber: string) {
    return await this.usersService.getSignupStatus(phoneNumber);
  };

}
