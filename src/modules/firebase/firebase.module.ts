import { Module } from '@nestjs/common';
import { FireBaseController } from './firebase.controller';
import { FirebaseService } from './firebase.service';
import { DBServicesModule } from 'src/common/repository/repository-services.module';
import { ConfigModule } from '@nestjs/config';
import { FirebaseConfig } from '../../common/config/firebase.config';

@Module({
  imports: [DBServicesModule, ConfigModule],
  controllers: [FireBaseController],
  providers: [FirebaseService, FirebaseConfig],
  exports: [FirebaseService]
})
export class FirebaseModule { }
