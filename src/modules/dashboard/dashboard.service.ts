import { Injectable, Logger } from '@nestjs/common';
import { DashboardMetricsResponseDto, InstitutionUserBreakdown } from './dto/dashboard-metrics.response.dto';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { RecordService } from '@noukha-technologies/mdm-core';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly dbService: IMongoDBServices,
    private readonly recordService: RecordService, 
  ) {}

  async getDashboardMetrics(origin?: string): Promise<DashboardMetricsResponseDto> {
    const cleanOrigin = origin?.trim();

    this.logger.log(
      `Dashboard metrics requested. Mode: ${cleanOrigin ? 'INSTITUTION' : 'GLOBAL'}`
    );
    if (cleanOrigin) {
      const institutions = await this.recordService.findAll('institutions', {
        page: 1,
        limit: 1,
        filters: { adminDomain: cleanOrigin },
      });

      const institution = institutions.items?.[0];
      if (institution) {
        const institutionId = institution.institutionsId;

        this.logger.log(
          `Institution resolved. Domain=${cleanOrigin}, institutionsId=${institutionId}`
        );

        const baseUserFilter = { isDeleted: false, institutionsId: institutionId };
        const baseReportFilter = { institutionsId: institutionId }; 
        const [activeUsers, inactiveUsers, totalUsers, departments, reviewReportsCount, pendingReportsCount, resolvedReportsCount] =
          await Promise.all([
            this.dbService.users.countDocuments({ ...baseUserFilter, status:"completed" }),
            this.dbService.users.countDocuments({ ...baseUserFilter, status:"pending" }),
            this.dbService.users.countDocuments(baseUserFilter),
            this.recordService.findAll('departments', {
              page: 1,
              limit: 1,
              filters: { institutionsId: institutionId },
            }),
            this.dbService.reviewReports.countDocuments(baseReportFilter),
            this.dbService.reviewReports.countDocuments({ ...baseReportFilter, status: 'PENDING' }),
            this.dbService.reviewReports.countDocuments({ ...baseReportFilter, status: 'RESOLVED' }),
          ]);

        return {
          activeUsers,
          inactiveUsers,
          totalUsers,
          departmentCount: departments.totalItems,
          reviewReportsCount,
          pendingReportsCount,
          resolvedReportsCount,
        };
      }

      this.logger.warn(`No institution found for origin: ${cleanOrigin}`);
      return {
        activeUsers: 0,
        inactiveUsers: 0,
        totalUsers: 0,
        departmentCount: 0,
        reviewReportsCount: 0,
        pendingReportsCount: 0,
        resolvedReportsCount: 0,
      };
    }
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
      this.dbService.users.countDocuments({ status:"completed", isDeleted: false }),
      this.dbService.users.countDocuments({ status:"pending", isDeleted: false }),
      this.dbService.users.countDocuments({ isDeleted: false }),
      this.dbService.reviewReports.countDocuments({}),
      this.dbService.reviewReports.countDocuments({status:'PENDING'}),
      this.dbService.reviewReports.countDocuments({status:'RESOLVED'}),
      this.recordService.findAll('institutions', { page: 1, limit: 1 }),
      this.recordService.findAll('departments', { page: 1, limit: 1 }),
    ]);

    // Fetch all institutions for breakdown
    const allInstitutions = await this.recordService.findAll('institutions', {
      nonPaginated: true,
    });

    // Get active users count for each institution
    const institutionBreakdown: InstitutionUserBreakdown[] = await Promise.all(
      allInstitutions.items.map(async (institution) => {
        const institutionId = institution.institutionsId;
        const activeUsersCount = await this.dbService.users.countDocuments({
          institutionsId: institutionId,
          status: 'completed',
          isDeleted: false,
        });

        return {
          institutionName: institution.institutionName || 'Unknown',
          activeUsers: activeUsersCount,
        };
      })
    );

    return {
      activeUsers,
      inactiveUsers,
      totalUsers,   
      reviewReportsCount,
      pendingReportsCount,
      resolvedReportsCount,
      institutionCount: institutions.totalItems,
      departmentCount: departments.totalItems,
      institutionBreakdown,
    };
  }
}
