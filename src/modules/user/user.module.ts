import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../common/services/email.module';
import { HttpClientModule } from 'src/common/inter-service-communication/http-client.module';
import { PaginationModule } from '../../common/shared/pagination/pagination.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    DBServicesModule,
    forwardRef(() => AuthModule),
    forwardRef(() => EmailModule),

    HttpClientModule,
    PaginationModule,
    NotificationModule
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}
