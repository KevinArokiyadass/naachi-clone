import { Module } from '@nestjs/common';
import { ReviewReportService } from './review-report.service';
import { ReviewReportController } from './review-report.controller';
import { ReviewReport, ReviewReportSchema } from './entities/review-report.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      {
        name: ReviewReport.name,
        schema: ReviewReportSchema
      },
    ]),
  ],
  controllers: [ReviewReportController],
  providers: [ReviewReportService],
  exports: [ReviewReportService, MongooseModule],
})
export class ReviewReportModule {}
