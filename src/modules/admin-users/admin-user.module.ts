import { Module } from '@nestjs/common';
import { AdminUserService } from './admin-user.service';
import { AdminUserController } from './admin-user.controller';
import { DBServicesModule } from '../../common/repository/repository-services.module';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { HttpClientModule } from '../../common/inter-service-communication/http-client.module';
import { CognitoService } from '../cognito/cognito.service';

@Module({
  imports: [
    DBServicesModule,
    PaginationModule,
    HttpClientModule,
  ],
  controllers: [AdminUserController],
  providers: [AdminUserService, CognitoService],
  exports: [AdminUserService]
})
export class AdminUserModule {}