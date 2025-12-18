import { Injectable, Logger } from '@nestjs/common';
import { DashboardMetricsResponseDto } from './dto/dashboard-metrics.response.dto';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { RecordService } from '@noukha-technologies/mdm-core';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly dbService: IMongoDBServices,
    private readonly recordService: RecordService, 
  ) {}

  async getDashboardMetrics(): Promise<DashboardMetricsResponseDto> {
    const [
      activeUsers,
      inactiveUsers,
      totalUsers,
      reviewReportsCount,
      pendingReportsCount,
      resolvedReportsCount,
      institutions,
      departments,
    ] = await Promise.all([
      this.dbService.users.countDocuments({ isActive: true, isDeleted: false }),
      this.dbService.users.countDocuments({ isActive: false, isDeleted: false }),
      this.dbService.users.countDocuments({ isDeleted: false }),
      this.dbService.reviewReports.countDocuments({}),
      this.dbService.reviewReports.countDocuments({status:'PENDING'}),
      this.dbService.reviewReports.countDocuments({status:'RESOLVED'}),
      this.recordService.findAll('institutions', { page: 1, limit: 1 }),
      this.recordService.findAll('departments', { page: 1, limit: 1 }),
    ]);

    return {
      activeUsers,
      inactiveUsers,
      totalUsers,   
      reviewReportsCount,
      pendingReportsCount,
      resolvedReportsCount,
      institutionCount: institutions.totalItems,
      departmentCount: departments.totalItems,
    };
  }
}
