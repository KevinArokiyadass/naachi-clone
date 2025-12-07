import { Controller, Get, Post, Patch, Put, Query, Req, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { GetPermissionsQueryDto } from './dto/get-permissions.dto';
import { interServiceRequestHelper } from '../../common/inter-service-communication/axios-wrapper';
import { ErrorException } from '../../common/errors/custom-error.exception';

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
  @ApiOperation({ summary: 'Create permission (redirected to record service)' })
  async createPermission(@Body() body: any, @Query() query: any, @Req() req: Request) {
    try {
      const headers = this.extractHeaders(req);
      return await interServiceRequestHelper({
        method: 'post',
        service: 'record',
        requestPath: 'permissions',
        headers,
        query,
        body,
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update permission (redirected to record service)' })
  async updatePermission(@Param('id') id: string, @Body() body: any, @Query() query: any, @Req() req: Request) {
    try {
      const headers = this.extractHeaders(req);
      return await interServiceRequestHelper({
        method: 'patch',
        service: 'record',
        requestPath: `permissions/${id}`,
        headers,
        query,
        body,
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace permission (redirected to record service)' })
  async replacePermission(@Param('id') id: string, @Body() body: any, @Query() query: any, @Req() req: Request) {
    try {
      const headers = this.extractHeaders(req);
      return await interServiceRequestHelper({
        method: 'put',
        service: 'record',
        requestPath: `permissions/${id}`,
        headers,
        query,
        body,
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  private extractHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    const reqHeaders = req.headers as unknown as Record<string, string | string[] | undefined>;
    
    // Forward authorization header
    if (reqHeaders['authorization']) {
      headers.authorization = Array.isArray(reqHeaders['authorization']) 
        ? reqHeaders['authorization'][0] 
        : reqHeaders['authorization'];
    }
    
    // Forward other important headers
    if (reqHeaders['accept']) {
      headers.accept = Array.isArray(reqHeaders['accept']) 
        ? reqHeaders['accept'][0] 
        : reqHeaders['accept'];
    }
    if (reqHeaders['content-type']) {
      headers['content-type'] = Array.isArray(reqHeaders['content-type']) 
        ? reqHeaders['content-type'][0] 
        : reqHeaders['content-type'];
    }
    
    return headers;
  }

  private handleError(error: any): never {
    let errorMessage = 'SOMETHING_WENT_WRONG';
    let statusCode = 500;
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
      statusCode = error.response.status || statusCode;
    } else if (error.message) {
      errorMessage = error.message;
      statusCode = error.status || statusCode;
    }
    
    throw new ErrorException(null, errorMessage, statusCode);
  }
}