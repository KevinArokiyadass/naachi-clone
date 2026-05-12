import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppLoggerService } from './common/logger/logger.service';
import { ResponseInterceptor } from './common/interceptor/response-transform.interceptor';
import { documentOptions, options, swaggerConfig } from './modules/swagger/swagger.module';
import { ValidationPipe } from '@nestjs/common';
const SwaggerModule = require('@nestjs/swagger').SwaggerModule;

function resolvePackageName(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
    if (typeof parsed.name === 'string' && parsed.name.length > 0) {
      return parsed.name;
    }
  } catch {
    // fall through
  }
  return 'naachi-user-service';
}

async function bootstrap() {
  const name = resolvePackageName();
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && req.path === '/') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        ok: true,
        service: name,
        apiBase: `/api/${name}`,
      });
    }
    if (req.method === 'GET' && req.path === '/favicon.ico') {
      return res.status(204).end();
    }
    return next();
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.setGlobalPrefix(`api/${name}`);

  app.enableCors({
    origin: true, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'user-current-view'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );


  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  // Swagger Setup
  const document = SwaggerModule.createDocument(
    app,
    swaggerConfig,
    documentOptions,
  );

  SwaggerModule.setup(`/api-docs/${name}`, app, document, options);

  logger.log('🚀 NestJS App Started...');
  const APP_PORT = process.env.PORT ?? 3000;
  await app.listen(APP_PORT, () => {
    logger.log(`✅ Server is running on http://localhost:${APP_PORT}`);
  });
}

bootstrap();
