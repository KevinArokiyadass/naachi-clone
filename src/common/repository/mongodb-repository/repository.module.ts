import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IMongoDBServices } from './abstract.repository';
import { MongoDBServices } from './repository.service';
import { Users, UsersSchema } from 'src/modules/users/entity/users.entity';
import { AdminUser, AdminUserSchema } from 'src/modules/admin-users/entities/admin-user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Users.name, schema: UsersSchema },
      { name: AdminUser.name, schema: AdminUserSchema },
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
