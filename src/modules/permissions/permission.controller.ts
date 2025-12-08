import { Controller, Get, Post, Patch, Put, Query, Req, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { GetPermissionsQueryDto } from './dto/get-permissions.dto';

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  async getPermissions(@Query() query: GetPermissionsQueryDto,  @Req() req: Request) {
    const {
      institutionsId = req['institutionsId'],
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

  @Post()
  @ApiOperation({ summary: 'Create permission' })
  async createPermission(@Body() body: any, @Req() req: Request) {
    const institutionsId = req['institutionsId'];
    return await this.permissionService.createPermission(body, institutionsId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update permission' })
  async updatePermission(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const institutionsId = req['institutionsId'];
    return await this.permissionService.updatePermission(id, body, institutionsId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace permission' })
  async replacePermission(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    const institutionsId = req['institutionsId'];
    return await this.permissionService.replacePermission(id, body, institutionsId);
  }
}