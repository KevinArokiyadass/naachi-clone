import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IMongoDBServices } from './abstract.repository';
import { MongoDBServices } from './repository.service';
import { Users, UsersSchema } from 'src/modules/users/entity/users.entity';
import { AdminUser, AdminUserSchema } from 'src/modules/admin-users/entities/admin-user.entity';
import { ReviewReport, ReviewReportSchema } from 'src/modules/review-report/entities/review-report.entity';
import { DeviceToken, DeviceTokenSchema } from 'src/modules/notifications/entity/device-token.entity';
import { NotificationHistory, NotificationHistorySchema } from 'src/modules/notifications/entity/notification-management.entity';
import { Configuration, ConfigurationSchema } from 'src/modules/configuration/entity/configuration.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema },
      { name: AdminUser.name, schema: AdminUserSchema },
      { name: ReviewReport.name, schema: ReviewReportSchema },
      { name: DeviceToken.name, schema: DeviceTokenSchema },
      { name: NotificationHistory.name, schema: NotificationHistorySchema },
      { name: Configuration.name, schema: ConfigurationSchema },
    ]),
  ],
  providers: [
    {
      provide: IMongoDBServices,
      useClass: MongoDBServices,
    },
  ],
  exports: [IMongoDBServices],
})
export class MongoDBServicesModule {
  constructor() {
    console.log('MongoDBServicesModule loaded');
  }
}
