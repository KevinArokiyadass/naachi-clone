import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PermissionGroupService } from './permission-group.service';
import { PermissionGroupController } from './permission-group.controller';
import { MdmCoreModule } from '@noukha-technologies/mdm-core';
import { PaginationModule } from 'src/common/shared/pagination/pagination.module';
import { HttpModule } from '@nestjs/axios';
import { ClientIdMiddleware } from '../../common/middleware/clientId.middlewere';

@Module({
  imports: [MdmCoreModule, PaginationModule, HttpModule],
  controllers: [PermissionGroupController],
  providers: [PermissionGroupService, ClientIdMiddleware],
  exports: [PermissionGroupService],
})
export class PermissionGroupModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply ClientIdMiddleware to all permission group routes
    // This sets req['isSuperAdminRequest'] or req['institutionsId'] based on origin
    consumer
      .apply(ClientIdMiddleware)
      .forRoutes(PermissionGroupController);
  }
}


