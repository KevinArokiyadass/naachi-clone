import { Injectable, Logger } from '@nestjs/common';
import { DashboardMetricsResponseDto } from './dto/dashboard-metrics.response.dto';
import { InstitutionMetricsDto } from 'src/modules/dashboard/dto/institution-metrics-dto';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly dbService: IMongoDBServices
  ) {}

  async getDashboardMetrics(): Promise<DashboardMetricsResponseDto> {
    const [
      activeUsers,
      inactiveUsers,
      reviewReports,
      uniqueReviewIds,
      institutions
    ] = await Promise.all([
      this.dbService.users.countDocuments({ isActive: true, isDeleted: false }),
      this.dbService.users.countDocuments({ isActive: false, isDeleted: false }),
      this.dbService.reviewReports.countDocuments({}),
      this.dbService.reviewReports.distinct('reviewId'),
      this.dbService.users.aggregate<InstitutionMetricsDto>([
        {
          $match: {
            referrerMedium: 'institutionMail',
            isDeleted: false,
            institutionsId: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$institutionsId',
            userCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'departments',
            localField: '_id',
            foreignField: 'institutionsId',
            as: 'departments'
          }
        },
        {
          $project: {
            _id: 0,
            institutionId: '$_id',
            userCount: 1,
            departmentCount: { $size: '$departments' }
          }
        }
      ])
    ]);

    return {
      activeUsers,
      inactiveUsers,
      reviewReports,
      totalReviews: uniqueReviewIds.length,
      institutionCount: institutions.length,
      institutions
    };
  }
}
