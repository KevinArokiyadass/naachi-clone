import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionController } from './permission.controller';
import { MdmCoreModule } from '@noukha-technologies/mdm-core';
import { PaginationModule } from 'src/common/shared/pagination/pagination.module';
import { HttpModule } from '@nestjs/axios';
import { ClientIdMiddleware } from '../../common/middleware/clientId.middlewere';


@Module({
    imports:[MdmCoreModule,PaginationModule,HttpModule],
    controllers:[PermissionController],
    providers:[PermissionService, ClientIdMiddleware],
    exports:[PermissionService]
})
export class PermissionModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // Apply ClientIdMiddleware to all permission routes
        // This sets req['isSuperAdminRequest'] or req['institutionsId'] based on origin
        consumer
            .apply(ClientIdMiddleware)
            .forRoutes(PermissionController);
    }
}