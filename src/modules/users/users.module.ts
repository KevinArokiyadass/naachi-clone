import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { CommonAuthModule } from 'src/common/services/common-auth.module';
import { UsersAuthService } from './users.service';
import { UsersController } from './users.controller';
import { UsersInstitutionBulkController } from './users-institution-bulk.controller';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Users, UsersSchema } from './entity/users.entity';
import { AwsStoreModule } from '../aws-store/aws-store.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { AdminUserModule } from '../admin-users/admin-user.module';
import { UserBulkParser } from './bulk-upload/user-bulk-parser';
import { UserBulkValidator } from './bulk-upload/user-bulk-validator';
import { UserBulkRepository } from './bulk-upload/user-bulk.repository';
import { UserBulkUploadService } from './bulk-upload/user-bulk-upload.service';
import { UserBulkRateLimitGuard } from './bulk-upload/user-bulk-rate-limit.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ClientIdMiddleware } from 'src/common/middleware/clientId.middlewere';

@Module({
    imports: [
        DBServicesModule,
        CommonAuthModule,
        AwsStoreModule,
        ConfigurationModule,
        AdminUserModule,
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema }
    ])
    ],
    controllers: [
        UsersController,
        UsersInstitutionBulkController,
    ],
    providers: [
        UsersAuthService,
        PaginationService,
        UserBulkParser,
        UserBulkValidator,
        UserBulkRepository,
        UserBulkUploadService,
        UserBulkRateLimitGuard,
        RolesGuard,
        ClientIdMiddleware,
    ],
    exports: [
      UsersAuthService,
      MongooseModule
    ],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ClientIdMiddleware).forRoutes(UsersInstitutionBulkController);
  }
}
