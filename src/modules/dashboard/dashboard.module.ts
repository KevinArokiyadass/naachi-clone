import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { HttpModule } from '@nestjs/axios';
import { MongoDBServicesModule } from 'src/common/repository/mongodb-repository/repository.module'; 

@Module({
  imports: [
    MongoDBServicesModule,
    HttpModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
