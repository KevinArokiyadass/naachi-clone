import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { HttpClientService } from '../inter-service-communication/http-client.service';
import { RecordService } from '@noukha-technologies/mdm-core';
import { HTTP_HEADERS } from '../constants/http-headers.constants';

@Injectable()
export class ClientIdMiddleware implements NestMiddleware {
  constructor(
    private readonly httpClientService: HttpClientService,
    private readonly recordService: RecordService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;
    
    const userCurrentViewHeader = req.headers[HTTP_HEADERS.USER_CURRENT_VIEW];
    
    if (userCurrentViewHeader && String(userCurrentViewHeader).toLowerCase() === 'naachi-cron') {
      req['isSuperAdminRequest'] = true;
      return next();
    }
  
    if (!origin) {
      throw new ForbiddenException('Origin header is required');
    }
  
    try {

      const normalizedOrigin = origin
        .replace(/^https?:\/\//, '') 
        .replace(/\/$/, '') 
        .toLowerCase();
  
      if (!normalizedOrigin) {
        throw new ForbiddenException('Invalid origin format');
      }
  

      const institutionsResult = await this.recordService.findAll('institutions', {
        filters: {
          $or: [
            { institutionDomain: normalizedOrigin }
          ]
        },
        nonPaginated: true
      });
  

      const institutions = institutionsResult?.items || [];
      
      if (!institutions || institutions.length === 0) {
        throw new ForbiddenException(`Unable to find institution for domain: ${normalizedOrigin}`);
      }
  
      const institution = institutions[0];
      const institutionsId = institution?.institutionsId;
  
      if (!institutionsId) {
        throw new ForbiddenException(`Institution found but missing institutionsId for domain: ${normalizedOrigin}`);
      }
  
      req['institutionsId'] = institutionsId ;
  
      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException(`Failed to fetch institutionId details: ${error.message}`);
    }
  }
}