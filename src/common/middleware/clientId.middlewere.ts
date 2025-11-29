import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RecordService } from '@noukha-technologies/mdm-core';

@Injectable()
export class ClientIdMiddleware implements NestMiddleware {
  constructor(
    private readonly recordService: RecordService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;
  
    if (!origin) {
      throw new ForbiddenException('Origin header is required');
    }

    try {
      const naachiAdminUrl = process.env.NAACHI_ADMIN_URL;
      if (naachiAdminUrl && naachiAdminUrl === origin) {
        req['isSuperAdminRequest'] = true;
        return next();
      }
      const institutionsResult = await this.recordService.findAll('institutions', {
        filters: {},
        nonPaginated: true
      });

      const institutions = institutionsResult?.items || [];
      
      const institution = institutions.find((inst: any) => {
        if (!inst.Domain) return false;
        return inst.Domain === origin;
      });
      
      if (!institution) {
        throw new ForbiddenException(`Unable to find institution for domain: ${origin}`);
      }

      const institutionsId = institution?.institutionsId;
  
      if (!institutionsId) {
        throw new ForbiddenException(`Institution found but missing institutionsId for domain: ${origin}`);
      }

      req['institutionsId'] = institutionsId;
  
      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException(`Failed to fetch institutionId details: ${error.message}`);
    }
  }
}