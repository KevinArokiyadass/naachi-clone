import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { Configuration, ConfigurationSchema } from './entity/configuration.entity';
import { ConfigurationService } from './configuration.service';
import { ConfigurationController } from './configuration.controller';

@Module({
  imports: [
    DBServicesModule,
    MongooseModule.forFeature([
      { name: Configuration.name, schema: ConfigurationSchema }
    ])
  ],
  controllers: [ConfigurationController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
