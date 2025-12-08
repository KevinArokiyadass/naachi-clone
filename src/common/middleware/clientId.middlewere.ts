import { Injectable, NestMiddleware, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RecordService } from '@noukha-technologies/mdm-core';

@Injectable()
export class ClientIdMiddleware implements NestMiddleware {
  constructor(
    private readonly recordService: RecordService
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;

    if (!origin) {
      throw new ForbiddenException('Origin header is required');
    }

    let naachiAdminUrl = process.env.NAACHI_ADMIN_URL;
    naachiAdminUrl = JSON.parse(naachiAdminUrl);
    if (naachiAdminUrl && naachiAdminUrl.includes(origin)) {
      req['isSuperAdminRequest'] = true;
      return next();
    }
    try {
      // Extract hostname from origin URL (e.g., "http://sastra.localhost:3000" -> "sastra.localhost")
      const originUrl = new URL(origin);
      const adminDomain = originUrl.origin;
      
      
      // Find institution by institutionDomain field using findAll with filters
      const institutionsResult = await this.recordService.findAll('institutions', {
        filters: {
          adminDomain: adminDomain,
          
        },
        nonPaginated: true,
      });
      if (!institutionsResult?.items || institutionsResult.items.length === 0) {
        throw new ForbiddenException(`Unable to find institution for domain: ${adminDomain}`);
      }

      const institution = institutionsResult.items[0];
      req['institutionsId'] = institution.institutionsId as string;
      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof NotFoundException) {
        throw new ForbiddenException(`Unable to find institution for domain: ${origin}`);
      }
      throw error;
    }
  }
}