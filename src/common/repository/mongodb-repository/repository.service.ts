import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMongoRepository } from './repository.abstract';
import { MongoRepository } from './repository';
import { UsersDocument } from 'src/modules/users/entity/users.entity';
import { IUsers } from 'src/common/interfaces/users.interface';
import { Users } from 'src/modules/users/entity/users.entity';
import { SignupTempDocument } from 'src/modules/users/entity/signup-temp.entity';
import { SignupTemp } from 'src/modules/users/entity/signup-temp.entity';
import { AdminUserDocument } from 'src/modules/admin-users/entities/admin-user.entity';
import { AdminUser } from 'src/modules/admin-users/entities/admin-user.entity';
import { IAdminUser } from 'src/common/interfaces/admin-user.interface';

@Injectable()
export class MongoDBServices {
  users: IMongoRepository<UsersDocument, IUsers, UsersDocument>;
  signupTemp: IMongoRepository<SignupTempDocument, any, SignupTempDocument>;
  adminUser: IMongoRepository<AdminUserDocument, IAdminUser, AdminUserDocument>;
  
  constructor(
    @InjectModel(Users.name)
    private usersRepository: Model<UsersDocument>,
    @InjectModel(SignupTemp.name)
    private signupTempRepository: Model<SignupTempDocument>,
    @InjectModel(AdminUser.name)
    private adminUserRepository: Model<AdminUserDocument>,
  ) {
    console.log('MongoDBServices loaded');
  }

  onApplicationBootstrap() {
    this.users = new MongoRepository<Users, IUsers, UsersDocument>(
      this.usersRepository,
    );
    this.signupTemp = new MongoRepository<SignupTemp, any, SignupTempDocument>(
      this.signupTempRepository,
    );
    this.adminUser = new MongoRepository<AdminUser, IAdminUser, AdminUserDocument>(
      this.adminUserRepository,
    );
    console.log('<== Mongo DB repositories got initialised ==>');
  }
}
