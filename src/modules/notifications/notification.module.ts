import { Module, forwardRef } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { PaginationModule } from 'src/common/shared/pagination/pagination.module';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [FirebaseModule, DBServicesModule, PaginationModule, forwardRef(() => UsersModule)],
    controllers: [NotificationController],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationModule {}