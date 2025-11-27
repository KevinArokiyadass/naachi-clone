import { Module } from '@nestjs/common';
import { ClientIdMiddleware } from './clientId.middlewere';
import { LoggerMiddleware } from './logger.middlewere';

@Module({
  imports: [],
  providers: [ClientIdMiddleware],
  exports: [ClientIdMiddleware],
})
export class MiddlewareModule {} 