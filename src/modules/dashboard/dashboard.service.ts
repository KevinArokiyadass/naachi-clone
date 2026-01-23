import { Injectable, Logger } from '@nestjs/common';
import { DashboardMetricsResponseDto } from './dto/dashboard-metrics.response.dto';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { RecordService } from '@noukha-technologies/mdm-core';
import { AwsStoreService } from '../aws-store/aws-store.service';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import { USER_STATUS, userStatus, RecordStatus } from 'src/common/enums/user.enum';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly dbService: IMongoDBServices,
    private readonly recordService: RecordService,
    private readonly awsStoreService: AwsStoreService,
    private readonly httpClient: HttpClientService,
  ) {}
     private async fetchDeptGroupCount(institutionId?: string): Promise<number> {
      try {
        const query: any = {
          ...(institutionId ? { institutionsId: institutionId } : {}),
          nonPaginated: true,
        };
    
        const res: any = await this.httpClient.get('NAACHI_CHAT_SERVICE', '/group', query);
    
        if (!res?.items) return 0;
    
        return res.items.filter(
          (g: any) => !g.isDeleted && g.departmentName != null
        ).length;
    
      } catch (err: any) {
        this.logger.warn(`Failed to fetch department group count: ${err.message}`);
        return 0;
      }
    }

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
      if (!institution) {
        return {
          activeUsers: 0,
          inactiveUsers: 0,
          totalUsers: 0,
          departmentCount: 0,
          departmentGroupCount: 0,
          reviewReportsCount: 0,
          pendingReportsCount: 0,
          resolvedReportsCount: 0,
        };
      }

        const institutionId = institution.institutionsId;

        this.logger.log(
          `Institution resolved. Domain=${cleanOrigin}, institutionsId=${institutionId}`
        );

        const baseUserFilter = { isDeleted: false, institutionsId: institutionId };
        const baseReportFilter = { institutionsId: institutionId }; 
        const [activeUsers, inactiveUsers, totalUsers, departments, reviewReportsCount, pendingReportsCount, resolvedReportsCount, rejectedReportsCount, departmentGroupCount] =
          await Promise.all([
            this.dbService.users.countDocuments({ ...baseUserFilter, status: USER_STATUS.ACTIVE }),
            this.dbService.users.countDocuments({ ...baseUserFilter, status: { $in: [USER_STATUS.PENDING, USER_STATUS.BLOCKED] } }),
            this.dbService.users.countDocuments(baseUserFilter),
            this.recordService.findAll('departments', {
              page: 1,
              limit: 1,
              filters: { institutionsId: institutionId },
            }),
            this.dbService.reviewReports.countDocuments(baseReportFilter),
            this.dbService.reviewReports.countDocuments({ ...baseReportFilter, status: RecordStatus.PENDING }),
            this.dbService.reviewReports.countDocuments({ ...baseReportFilter, status: RecordStatus.RESOLVED }),
            this.dbService.reviewReports.countDocuments({ ...baseReportFilter, status: RecordStatus.REJECTED }),
            this.fetchDeptGroupCount(institutionId),
          ]);

        return {
          activeUsers,
          inactiveUsers,
          totalUsers,
          departmentCount: departments.totalItems,
          departmentGroupCount,
          reviewReportsCount,
          pendingReportsCount,
          resolvedReportsCount,
          rejectedReportsCount,
        };
      }

    const [
      activeUsers,
      inactiveUsers,
      totalUsers,
      reviewReportsCount,
      pendingReportsCount,
      resolvedReportsCount,
      rejectedReportsCount,
      institutions,
      departments,
      departmentGroupCount,
    ] = await Promise.all([
      this.dbService.users.countDocuments({ status: USER_STATUS.ACTIVE, isDeleted: false }),  
      this.dbService.users.countDocuments({ status: USER_STATUS.PENDING, isDeleted: false }),
      this.dbService.users.countDocuments({ isDeleted: false }),
      this.dbService.reviewReports.countDocuments({}),
      this.dbService.reviewReports.countDocuments({status: RecordStatus.PENDING}),
      this.dbService.reviewReports.countDocuments({status: RecordStatus.RESOLVED}),
      this.dbService.reviewReports.countDocuments({status: RecordStatus.REJECTED}),
      this.recordService.findAll('institutions', { page: 1, limit: 1 }),
      this.recordService.findAll('departments', { page: 1, limit: 1 }),
      this.fetchDeptGroupCount(),
    ]);

    // Fetch all institutions for breakdown
    const allInstitutions = await this.recordService.findAll('institutions', {
      nonPaginated: true,
    });

    // Get active users count for each institution and append to institution data
    const institutionBreakdown = await Promise.all(
      allInstitutions.items.map(async (institution) => {
        const institutionId = institution.institutionsId;
        const activeUsersCount = await this.dbService.users.countDocuments({
          institutionsId: institutionId,
          status: USER_STATUS.ACTIVE,
          isDeleted: false,
        });

        // Convert Mongoose document to plain object by extracting _doc or using JSON serialization
        let plainInstitution: any;
        if (institution && typeof institution === 'object') {
          // If it's a Mongoose document with _doc, use that (most efficient)
          if (institution._doc) {
            plainInstitution = { ...institution._doc };
          } else {
            // Use JSON serialization to strip all Mongoose internals ($__, $isNew, etc.)
            plainInstitution = JSON.parse(JSON.stringify(institution));
          }
        } else {
          plainInstitution = institution;
        }

        // Compute s3ProfileImageUrl from s3ProfileImageName if it exists
        if (plainInstitution.s3ProfileImageName) {
          plainInstitution.s3ProfileImageUrl = this.awsStoreService.getCloudFrontUrl(
            plainInstitution.s3ProfileImageName
          );
        }

        // Return plain institution object with activeUsers appended
        return {
          ...plainInstitution,
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
      rejectedReportsCount,
      institutionCount: institutions.totalItems,
      departmentCount: departments.totalItems,
      departmentGroupCount,
      institutionBreakdown,
    };
  }

  async getInstitutionDashboardMetrics(
    origin: string,
  ): Promise<DashboardMetricsResponseDto> {
    const cleanOrigin = origin?.trim();

    const institutions = await this.recordService.findAll('institutions', {
      page: 1,
      limit: 1,
      filters: { adminDomain: cleanOrigin },
    });

    const institution = institutions.items?.[0];
    if (!institution) {
      return {
        activeUsers: 0,
        inactiveUsers: 0,
        totalUsers: 0,
        reviewReportsCount: 0,
        pendingReportsCount: 0,
        resolvedReportsCount: 0,
        institutionCount: 0,
        departmentCount: 0,
        departmentGroupCount: 0,
        institutionBreakdown: [],
      };
    }

    const institutionId = institution.institutionsId;
    const baseUserFilter = { institutionsId: institutionId, isDeleted: false };
    const baseReportFilter = { institutionsId: institutionId };

    const [
      activeUsers,
      inactiveUsers,
      totalUsers,
      reviewReportsCount,
      pendingReportsCount,
      resolvedReportsCount,
      rejectedReportsCount,
      departments,
      departmentGroupCount,
    ] = await Promise.all([
      this.dbService.users.countDocuments({ ...baseUserFilter, status: USER_STATUS.ACTIVE }),
      this.dbService.users.countDocuments({ ...baseUserFilter, status: USER_STATUS.PENDING }),
      this.dbService.users.countDocuments(baseUserFilter),
      this.dbService.reviewReports.countDocuments(baseReportFilter),
      this.dbService.reviewReports.countDocuments({
        ...baseReportFilter,
        status: RecordStatus.PENDING,
      }),
      this.dbService.reviewReports.countDocuments({
        ...baseReportFilter,
        status: RecordStatus.RESOLVED,
      }),
      this.dbService.reviewReports.countDocuments({
        ...baseReportFilter,
        status: RecordStatus.REJECTED,
      }),
      this.recordService.findAll('departments', {
        page: 1,
        limit: 1,
        filters: { institutionsId: institutionId },
      }),
      this.fetchDeptGroupCount(institutionId),
    ]);

    const plainInstitution = institution._doc
      ? { ...institution._doc }
      : JSON.parse(JSON.stringify(institution));

    if (plainInstitution.s3ProfileImageName) {
      plainInstitution.s3ProfileImageUrl =
        this.awsStoreService.getCloudFrontUrl(
          plainInstitution.s3ProfileImageName,
        );
    }

    return {
      activeUsers,
      inactiveUsers,
      totalUsers,
      reviewReportsCount,
      pendingReportsCount,
      resolvedReportsCount,
      rejectedReportsCount,
      institutionCount: 1,
      departmentCount: departments.totalItems,
      departmentGroupCount,
      institutionBreakdown: [
        {
          ...plainInstitution,
          activeUsers,
        },
      ],
    };
  }
}
