import { Injectable } from '@nestjs/common';
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

@Injectable()
export class MongoDBServices {
  users: IMongoRepository<Users, IUsers, UsersDocument>;
  adminUser: IMongoRepository<AdminUser, IAdminUser, AdminUserDocument>;
  reviewReports: IMongoRepository<ReviewReport, IReviewReport, Report>;
  constructor(
    @InjectModel(Users.name)
    private usersRepository: Model<Users>,
    @InjectModel(AdminUser.name)
    private adminUserRepository: Model<AdminUser>,
    @InjectModel(ReviewReport.name)
    private reviewReportRepository: Model<ReviewReport>,
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
    console.log('<== Mongo DB repositories got initialised ==>');
  }
}
