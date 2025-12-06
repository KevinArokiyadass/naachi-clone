import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PermissionGroupService } from './permission-group.service';
import { GetPermissionGroupsQueryDto } from './dto/get-permission-groups.dto';

@Controller('permissionGroups')
export class PermissionGroupController {
  constructor(private readonly permissionGroupService: PermissionGroupService) {}

  @Get()
  @ApiOperation({ summary: 'Get permission groups' })
  @ApiResponse({ status: 200, description: 'Permission groups retrieved successfully' })
  async getPermissionGroups(@Query() query: GetPermissionGroupsQueryDto, @Req() req: Request) {
    const {
      institutionsId = req['institutionsId'],
      skip = 0,
      limit = 10,
      search,
      nonPaginated = false,
      sort = 'createdAt',
      order = 'desc',
    } = query;

    return this.permissionGroupService.getPermissionGroups(
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

