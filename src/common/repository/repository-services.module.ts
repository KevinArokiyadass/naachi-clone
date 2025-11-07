import { Module } from '@nestjs/common';
import { MongoDBServicesModule } from './mongodb-repository/repository.module';

@Module({
    imports: [MongoDBServicesModule],
    exports: [MongoDBServicesModule],
})
export class DBServicesModule { }
