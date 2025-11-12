import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Naachi user service is up and healthy';
  }

  getWelcome() {
    return {
      message: 'Welcome to Naachi User Service API',
      version: process.env.npm_package_version || '1.0.0',
      documentation: '/api',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: {
          basic: '/health',
          detailed: '/health/detailed',
          readiness: '/health/readiness',
          liveness: '/health/liveness'
        },
        auth: '/users-auth',
        swagger: '/api'
      }
    };
  }
}
