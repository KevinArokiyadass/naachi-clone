import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IMongoDBServices } from './abstract.repository';
import { MongoDBServices } from './repository.service';
import { User, UserSchema } from 'src/modules/user/entity/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [
    {
      provide: IMongoDBServices,
      useClass: MongoDBServices,
    },
  ],
  exports: [IMongoDBServices],
})
export class MongoDBServicesModule {
  constructor() {
    console.log('MongoDBServicesModule loaded');
  }
}
