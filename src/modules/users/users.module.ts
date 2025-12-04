import { Module, forwardRef } from '@nestjs/common';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { CommonAuthModule } from 'src/common/services/common-auth.module';
import { UsersAuthService } from './users.service';
import { UsersController } from './users.controller';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Users, UsersSchema } from './entity/users.entity';

@Module({
    imports: [
        DBServicesModule,
        CommonAuthModule,
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema }
    ])
    ],
    controllers: [
        UsersController
    ],
    providers: [
        UsersAuthService,
        PaginationService
    ],
    exports: [
      UsersAuthService,
      MongooseModule
    ],
})
export class UsersModule { }
