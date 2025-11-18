import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { EmailModule } from 'src/common/services/email.module';
import { CommonAuthModule } from 'src/common/services/common-auth.module';
import { UsersPhoneAuthService } from './phone-auth.service';
import { UsersPhoneAuthController } from './users.controller';

@Module({
    imports: [
        DBServicesModule,
        forwardRef(() => EmailModule),
        CommonAuthModule,
    ],
    controllers: [
        UsersController,
        UsersPhoneAuthController
    ],
    providers: [
        UsersService,
        UsersPhoneAuthService
    ],
    exports: [
        UsersService,
        UsersPhoneAuthService
    ]
})
export class UsersModule { }
