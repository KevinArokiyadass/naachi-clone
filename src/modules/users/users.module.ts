import { MiddlewareConsumer, Module, NestModule, forwardRef } from '@nestjs/common';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { CommonAuthModule } from 'src/common/services/common-auth.module';
import { UsersAuthService } from './users.service';
import { UsersController } from './users.controller';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Users, UsersSchema } from './entity/users.entity';
import { AwsStoreModule } from '../aws-store/aws-store.module';
import { ClientIdMiddleware } from 'src/common/middleware/clientId.middlewere';

@Module({
    imports: [
        DBServicesModule,
        CommonAuthModule,
        AwsStoreModule,
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema }
    ])
    ],
    controllers: [
        UsersController
    ],
    providers: [
        UsersAuthService,
        PaginationService,
        ClientIdMiddleware
    ],
    exports: [
      UsersAuthService,
      MongooseModule
    ],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ClientIdMiddleware)
      .forRoutes(UsersController);
  }
}
