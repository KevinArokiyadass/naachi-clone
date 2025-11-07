import { HttpModule } from '@nestjs/axios';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { MdmCoreModule } from '@noukha-technologies/mdm-core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HttpClientModule } from './common/inter-service-communication/http-client.module';
import { AppLoggerService } from './common/logger/logger.service';
import { RequestContextService } from './common/middleware/request.service';
import { TraceContextMiddleware } from './common/middleware/trace.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UserModule } from './modules/user/user.module';
import { AwsStoreModule } from './modules/aws-store/aws-store.module';

const ENV = process.env.NODE_ENV;

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: !ENV ? '.env' : `.env.${ENV}`
    }),
    EventEmitterModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URL, {
      minPoolSize: 10,
      maxPoolSize: 100,
      ssl: true,
      tls: true,
      retryWrites: true,
      w: 'majority'
    }),
    HttpModule,
    HttpClientModule,
    AuthModule,
    UserModule,
    NotificationModule,
    MdmCoreModule.forRoot({
      database: {
        connectionString: process.env.MONGODB_URI
      },
      schema: {
        collectionName: 'schemas',
        cacheEnabled: true,
        autoCreateCollections: true
      },
      logging: {
        enabled: true,
        level: 'info'
      }
    }),
    AwsStoreModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppLoggerService,
    RequestContextService
  ],
  exports: [AppLoggerService, RequestContextService]
})

export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceContextMiddleware).forRoutes('*');
  }
}
