import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const entryTime = new Date().toISOString();

    console.log(`[${entryTime}] - API Entered: ${req.method} ${req.originalUrl}`);

    // Listen for the response finish event
    res.on('finish', () => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const exitTime = new Date().toISOString();

      console.log(
        `[${exitTime}] - API Completed: ${req.method} ${req.originalUrl} - Time Taken: ${responseTime}ms`
      );
    });

    next(); // Pass control to the next middleware or route handler
  }
}
