import { Controller, Get, Post, Patch, Put, Query, Req, Body, Param } from '@nestjs/common';
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

  @Post()
  @ApiOperation({ summary: 'Create permission group' })
  async createPermissionGroup(@Body() body: any, @Req() req: Request) {
    const institutionsId = req['institutionsId'];
    return await this.permissionGroupService.createPermissionGroup(body, institutionsId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update permission group' })
  async updatePermissionGroup(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const institutionsId = req['institutionsId'];
    return await this.permissionGroupService.updatePermissionGroup(id, body, institutionsId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace permission group' })
  async replacePermissionGroup(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const institutionsId = req['institutionsId'];
    return await this.permissionGroupService.replacePermissionGroup(id, body, institutionsId);
  }
}

