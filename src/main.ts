import { setServers } from 'node:dns';
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

/**
 * Recursively strips MongoDB operator keys (those starting with `$` or containing
 * a `.`) from request payloads, mutating objects in place. Acts as an
 * application-wide guard against NoSQL operator injection (e.g. `?userId[$ne]=`),
 * complementing the per-query `prepareMongoFilter` sanitisation in the repository
 * layer. Mutation is in place because Express 5 exposes `req.query` as a getter.
 */
function stripMongoOperators(value: unknown): void {
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) stripMongoOperators(item);
    return;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete (value as Record<string, unknown>)[key];
      continue;
    }
    stripMongoOperators((value as Record<string, unknown>)[key]);
  }
}

function mongoSanitizeMiddleware(req: Request, _res: Response, next: NextFunction) {
  stripMongoOperators(req.body);
  stripMongoOperators(req.query);
  stripMongoOperators(req.params);
  next();
}

/** Windows/local dev: default DNS often fails MongoDB Atlas SRV lookups (querySrv ECONNREFUSED). */
function configureDnsForMongoSrv() {
  const fromEnv = process.env.MONGODB_DNS_SERVERS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const servers =
    fromEnv?.length ? fromEnv : process.env.NODE_ENV === 'dev' ? ['8.8.8.8', '1.1.1.1'] : undefined;
  if (servers?.length) {
    setServers(servers);
  }
}

async function bootstrap() {
  configureDnsForMongoSrv();
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

  // Strip MongoDB operator keys from all incoming requests (NoSQL injection guard).
  expressApp.use(mongoSanitizeMiddleware);

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
