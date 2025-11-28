import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppLoggerService } from './common/logger/logger.service';
import { ResponseInterceptor } from './common/interceptor/response-transform.interceptor';
import { documentOptions, options, swaggerConfig } from './modules/swagger/swagger.module';
import { name } from '../package.json';
import { ValidationPipe } from '@nestjs/common';
const SwaggerModule = require('@nestjs/swagger').SwaggerModule;
import { Whitelists } from './common/constants/service-common.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.setGlobalPrefix(`api/${name}`);

  app.enableCors({
    origin(origin, callback) {
  
      if (!origin) {
        return callback(null, true);
      }
      

      if (Whitelists.includes(origin)) {
        return callback(null, true);
      }
      
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
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
