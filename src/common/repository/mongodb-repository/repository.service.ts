import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMongoRepository } from './repository.abstract';
import { MongoRepository } from './repository';
import { UsersDocument } from 'src/modules/users/entity/users.entity';
import { IUsers } from 'src/common/interfaces/users.interface';
import { Users } from 'src/modules/users/entity/users.entity';
import { AdminUserDocument } from 'src/modules/admin-users/entities/admin-user.entity';
import { AdminUser } from 'src/modules/admin-users/entities/admin-user.entity';
import { IAdminUser } from 'src/common/interfaces/admin-user.interface';
import { IMongoDBServices } from './abstract.repository';
import { ReviewReport, Report } from 'src/modules/review-report/entities/review-report.entity';
import { IReviewReport } from 'src/common/interfaces/review-report.interface';
import { DeviceToken, DeviceTokenDocument } from 'src/modules/notifications/entity/device-token.entity';
import { IDeviceToken } from 'src/common/interfaces/device.token.interface';
import { NotificationHistory, NotificationHistoryDocument } from 'src/modules/notifications/entity/notification-management.entity';
import { INotificationManagement } from 'src/common/interfaces/notification.interface';
import { Configuration, ConfigurationDocument } from 'src/modules/configuration/entity/configuration.entity';
import { IConfiguration } from 'src/common/interfaces/configuration.interface';

@Injectable()
export class MongoDBServices implements IMongoDBServices, OnApplicationBootstrap {
  users: IMongoRepository<Users, IUsers, UsersDocument>;
  adminUser: IMongoRepository<AdminUser, IAdminUser, AdminUserDocument>;
  reviewReports: IMongoRepository<Report, IReviewReport, ReviewReport>;
  deviceToken: IMongoRepository<DeviceToken, IDeviceToken, DeviceTokenDocument>;
  notificationHistory: IMongoRepository<NotificationHistory, INotificationManagement, NotificationHistoryDocument>;
  configuration: IMongoRepository<Configuration, IConfiguration, ConfigurationDocument>;

  constructor(
    @InjectModel(Users.name)
    private usersRepository: Model<Users>,
    @InjectModel(AdminUser.name)
    private adminUserRepository: Model<AdminUser>,
    @InjectModel(ReviewReport.name)
    private reviewReportRepository: Model<ReviewReport>,
    @InjectModel(DeviceToken.name)
    private deviceTokenRepository: Model<DeviceToken>,
    @InjectModel(NotificationHistory.name)
    private notificationHistoryRepository: Model<NotificationHistory>,
    @InjectModel(Configuration.name)
    private configurationRepository: Model<Configuration>,
  ) {
    console.log('MongoDBServices loaded');
  }

  onApplicationBootstrap() {
    this.users = new MongoRepository<Users, IUsers, UsersDocument>(
      this.usersRepository,
    );
    this.adminUser = new MongoRepository<AdminUser, IAdminUser, AdminUserDocument>(
      this.adminUserRepository,
    );
    this.reviewReports = new MongoRepository<ReviewReport, IReviewReport, ReviewReport>(
      this.reviewReportRepository
    );
    this.deviceToken = new MongoRepository<DeviceToken, IDeviceToken, DeviceTokenDocument>(
      this.deviceTokenRepository
    );
    this.notificationHistory = new MongoRepository<NotificationHistory, INotificationManagement, NotificationHistoryDocument>(
      this.notificationHistoryRepository
    );
    this.configuration = new MongoRepository<Configuration, IConfiguration, ConfigurationDocument>(
      this.configurationRepository
    );
    console.log('<== Mongo DB repositories got initialised ==>');
  }
}
