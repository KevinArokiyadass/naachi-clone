import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { sanitizeMongoInput } from '../utils/mongo-sanitize.util';

@Injectable()
export class MongoSanitizeMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeMongoInput(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeMongoInput(req.query) as Request['query'];
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeMongoInput(req.params) as Request['params'];
    }
    next();
  }
}
