import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsResponseDto } from './dto/dashboard-metrics.response.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  async getDashboardMetrics(
    @Query('Origin') origin?: string,
  ): Promise<DashboardMetricsResponseDto> {
    return this.dashboardService.getDashboardMetrics(origin);
  }
  @Get('metrics/institution')
  async getInstitutionDashboardMetrics(
    @Query('Origin') origin: string,
  ): Promise<DashboardMetricsResponseDto> {
    return this.dashboardService.getInstitutionDashboardMetrics(origin);
  }
}
