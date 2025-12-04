import { Module } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionController } from './permission.controller';
import { MdmCoreModule } from '@noukha-technologies/mdm-core';
import { PaginationModule } from 'src/common/shared/pagination/pagination.module';
import { HttpModule } from '@nestjs/axios';


@Module({
    imports:[MdmCoreModule,PaginationModule,HttpModule],
    controllers:[PermissionController],
    providers:[PermissionService],
    exports:[PermissionService]
})
export class PermissionModule { }