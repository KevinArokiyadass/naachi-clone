import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { GetPermissionsQueryDto } from './dto/get-permissions.dto';
import { GetPermissionGroupsQueryDto } from './dto/get-permission-groups.dto';

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  async getPermissions(@Query() query: GetPermissionsQueryDto) {
    const {
      institutionsId,
      skip = 0,
      limit = 10,
      search,
      nonPaginated = false,
      sort = 'createdAt',
      order = 'desc',
    } = query;

    return this.permissionService.getPermissions(
      institutionsId,
      skip,
      limit,
      search,
      nonPaginated,
      sort,
      order,
    );
  }

  @Get('groups')
  async getPermissionGroups(@Query() query: GetPermissionGroupsQueryDto) {
    const {
      institutionsId,
      skip = 0,
      limit = 10,
      search,
      nonPaginated = false,
      sort = 'createdAt',
      order = 'desc',
    } = query;

    return this.permissionService.getPermissionGroups(
      institutionsId,
      skip,
      limit,
      search,
      nonPaginated,
      sort,
      order,
    );
  }
}