import { IsString, Matches, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @Matches(/[A-Z]/, { message: 'Password must include at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must include at least one lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must include at least one digit' })
  @Matches(/[@$!%*?&#]/, { message: 'Password must include at least one special character' })
  newPassword: string;
}
