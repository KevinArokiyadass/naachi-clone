import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { sanitizeMongoInput } from '../utils/mongo-sanitize.util';

@Injectable()
export class MongoSanitizeMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeMongoInput(req.body);
    }
    // req.query and req.params are read-only in Express 5 — mutate in place instead of reassigning.
    replaceObjectContents(req.query, sanitizeMongoInput(req.query) as Request['query']);
    replaceObjectContents(req.params, sanitizeMongoInput(req.params) as Request['params']);
    next();
  }
}

function replaceObjectContents<T extends Record<string, unknown>>(target: T, source: T) {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
}
