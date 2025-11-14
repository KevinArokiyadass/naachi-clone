import { Module } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminUserModule } from '../admin-users/admin-user.module';
import { AdminAuthController } from './admin-auth.controller';
import { CognitoModule } from '../cognito/cognito.module';

@Module({
  imports: [
    AdminUserModule,
    CognitoModule
  ],
  providers: [
    AdminAuthService
  ],
  controllers: [AdminAuthController],
})
export class AdminAuthModule {}