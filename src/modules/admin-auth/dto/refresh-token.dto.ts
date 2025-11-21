import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token for generating new access token',
    example: 'eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ...'
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refresh_token: string;

  @ApiProperty({
    description: 'Username ((email/user) used when signing in)',
    example: 'admin@example.com'
  })
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  userName: string;
}
