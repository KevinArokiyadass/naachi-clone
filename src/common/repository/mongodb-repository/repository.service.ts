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

@Injectable()
export class MongoDBServices {
  users: IMongoRepository<UsersDocument, IUsers, UsersDocument>;
  signupTemp: IMongoRepository<SignupTempDocument, any, SignupTempDocument>;
  
  constructor(
    @InjectModel(Users.name)
    private usersRepository: Model<UsersDocument>,
    @InjectModel(SignupTemp.name)
    private signupTempRepository: Model<SignupTempDocument>,
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
    console.log('<== Mongo DB repositories got initialised ==>');
  }
}
