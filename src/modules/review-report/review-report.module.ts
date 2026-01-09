import { Module } from '@nestjs/common';
import { ReviewReportService } from './review-report.service';
import { ReviewReportController } from './review-report.controller';
import { ReviewReport, ReviewReportSchema } from './entities/review-report.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/modules/users/users.module';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import { Users, UsersSchema } from 'src/modules/users/entity/users.entity';
import { HttpClientModule } from 'src/common/inter-service-communication/http-client.module';

@Module({
  imports: [
    UsersModule,
    HttpClientModule,
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
  providers: [ReviewReportService, PaginationService],
  exports: [ReviewReportService, MongooseModule],
})
export class ReviewReportModule { }
