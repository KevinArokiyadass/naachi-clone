import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Welcome message',
    description: 'Returns a welcome message for the Naachi user service'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Welcome message',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Welcome to Naachi User Service API' },
        version: { type: 'string', example: '1.0.0' },
        documentation: { type: 'string', example: '/api' }
      }
    }
  })
  getWelcome() {
    return this.appService.getWelcome();
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Basic health check (Legacy)',
    description: 'Legacy health endpoint - use /health/* endpoints for detailed health checks'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Basic health status',
    schema: {
      type: 'string',
      example: 'Naachi user service is up and healthy'
    }
  })
  getHealth(): string {
    return this.appService.getHello();
  }
}
