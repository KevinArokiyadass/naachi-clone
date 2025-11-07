import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Email address associated with the OTP',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '482913',
    description: 'One-time password (OTP) sent to the user email',
  })
  @IsNotEmpty()
  otp: string;
}
