import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Admin username',
    example: 'admin_user'
  })
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  userName: string;

  @ApiProperty({
    description: 'Admin password',
    example: 'SecurePass123!',
    minLength: 8
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}
