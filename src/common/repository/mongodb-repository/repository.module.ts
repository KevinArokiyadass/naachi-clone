import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IMongoDBServices } from './abstract.repository';
import { MongoDBServices } from './repository.service';
import { Users, UsersSchema } from 'src/modules/users/entity/users.entity';
import { SignupTemp, SignupTempSchema } from 'src/modules/users/entity/signup-temp.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema },
      { name: SignupTemp.name, schema: SignupTempSchema },
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
