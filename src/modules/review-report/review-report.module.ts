import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ReviewReportService } from './review-report.service';
import { ReviewReportController } from './review-report.controller';
import { ReviewReport, ReviewReportSchema } from './entities/review-report.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/modules/users/users.module';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import { Users, UsersSchema } from 'src/modules/users/entity/users.entity';
import { HttpClientModule } from 'src/common/inter-service-communication/http-client.module';
import { MongoDBServicesModule } from 'src/common/repository/mongodb-repository/repository.module';
import { ClientIdMiddleware } from 'src/common/middleware/clientId.middlewere';
import { AdminUserModule } from '../admin-users/admin-user.module';

@Module({
  imports: [
    UsersModule,
    HttpClientModule,
    MongoDBServicesModule,
    AdminUserModule,
    MongooseModule.forFeature([
      {
        name: ReviewReport.name,
        schema: ReviewReportSchema
      },
      {
        name: Users.name,
        schema: UsersSchema
      },
    ]),
  ],
  controllers: [ReviewReportController],
  providers: [ReviewReportService, PaginationService, ClientIdMiddleware],
  exports: [ReviewReportService, MongooseModule],
})
export class ReviewReportModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ClientIdMiddleware)
      .exclude({ path: 'review-report', method: RequestMethod.POST })
      .forRoutes(ReviewReportController);
  }
}
