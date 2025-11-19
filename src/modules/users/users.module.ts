import { Module, forwardRef } from '@nestjs/common';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { CommonAuthModule } from 'src/common/services/common-auth.module';
import { UsersAuthService } from './users.service';
import { UsersController } from './users.controller';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';

@Module({
    imports: [
        DBServicesModule,
        CommonAuthModule,
    ],
    controllers: [
        UsersController
    ],
    providers: [
        UsersAuthService,
        PaginationService
    ],
    exports: [
        UsersAuthService
    ]
})
export class UsersModule { }
