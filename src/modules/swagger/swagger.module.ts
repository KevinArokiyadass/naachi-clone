import {
  DocumentBuilder,
} from '@nestjs/swagger';
import { name } from '../../../package.json';

// swagger
export const swaggerConfig = new DocumentBuilder()
  .setTitle(name)
  .setDescription(`Naachi User Service APIs documentation`)
  .setVersion('1.0')
  .addTag(name)
  .addBearerAuth()
  .build();

export const documentOptions = {
  deepScanRoutes: true,
};

export const options = {
  customSiteTitle: 'Naachi User Service API Docs',
};
