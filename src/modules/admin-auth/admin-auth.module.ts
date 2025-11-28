import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminUserModule } from '../admin-users/admin-user.module';
import { AdminAuthController } from './admin-auth.controller';
import { CognitoModule } from '../cognito/cognito.module';
import { ClientIdMiddleware } from '../../common/middleware/clientId.middlewere';
import { HttpClientModule } from '../../common/inter-service-communication/http-client.module' ;

@Module({
  imports: [
    AdminUserModule,
    CognitoModule,
    HttpClientModule
  ],
  providers: [
    AdminAuthService,
    ClientIdMiddleware
  ],
  controllers: [AdminAuthController],
})
export class AdminAuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ClientIdMiddleware)
      .forRoutes(AdminAuthController);
  }
}