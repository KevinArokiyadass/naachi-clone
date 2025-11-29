import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdminUserService } from './admin-user.service';
import { AdminUserController } from './admin-user.controller';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { HttpClientModule } from '../../common/inter-service-communication/http-client.module';
import { CognitoService } from '../cognito/cognito.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClientIdMiddleware } from '../../common/middleware/clientId.middlewere';

@Module({
  imports: [
    DBServicesModule,
    PaginationModule,
    HttpClientModule,
  ],
  controllers: [AdminUserController],
  providers: [AdminUserService, CognitoService, RolesGuard, ClientIdMiddleware],
  exports: [AdminUserService]
})
export class AdminUserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply ClientIdMiddleware to all admin-user routes
    // This sets req['isSuperAdminRequest'] or req['institutionsId'] based on origin
    // This must run BEFORE CognitoAuthGuard and RolesGuard
    consumer
      .apply(ClientIdMiddleware)
      .forRoutes(AdminUserController);
  }
}