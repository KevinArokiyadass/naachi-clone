import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmSignUpDto {
  @ApiProperty({
    description: 'Admin username',
    example: 'admin_user'
  })
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  userName: string;

  @ApiProperty({
    description: 'Verification code from email',
    example: '123456',
    minLength: 6,
    maxLength: 6
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  code: string;

  @ApiProperty({
    description: 'Admin password',
    example: 'SecurePass123!'
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
