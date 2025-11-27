import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { HttpClientService } from '../inter-service-communication/http-client.service';
import { RecordService } from '@noukha-technologies/mdm-core';

@Injectable()
export class ClientIdMiddleware implements NestMiddleware {
  constructor(
    private readonly httpClientService: HttpClientService,
    private readonly recordService: RecordService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;
    const USER_CURRENT_VIEW = req.headers['stripe-signature'];
    
    // Bypass middleware for Stripe webhooks
    if (USER_CURRENT_VIEW) {
      return next();
    }
  
    if (!origin) {
      throw new ForbiddenException('Origin header is required');
    }
  
    try {
      // Normalize origin URL: remove protocol and trailing slashes
      const normalizedOrigin = origin
        .replace(/^https?:\/\//, '') // Remove http:// or https://
        .replace(/\/$/, '') // Remove trailing slash
        .toLowerCase();
  
      if (!normalizedOrigin) {
        throw new ForbiddenException('Invalid origin format');
      }
  
      // Fetch institution by domain
      const institutionResult = await this.recordService.findAll('institutions', {
        filters: {
          $or: [
            { institutionDomain: normalizedOrigin }
          ]
        },
        nonPaginated: true
      });
  
      // Extract institution from result (recordService.findAll returns { items: [...] })
      const institutions = institutionResult?.items || [];
      
      if (!institutions || institutions.length === 0) {
        throw new ForbiddenException(`Unable to find institution for domain: ${normalizedOrigin}`);
      }
  
      const institution = institutions[0];
      const institutionId = institution?.institutionsId || institution?._id;
  
      if (!institutionId) {
        throw new ForbiddenException(`Institution found but missing institutionsId for domain: ${normalizedOrigin}`);
      }
  
      // Set institutionsId in request for consistency
      req['institutionsId'] = institutionId;
  
      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException(`Failed to fetch institutionId details: ${error.message}`);
    }
  }
}