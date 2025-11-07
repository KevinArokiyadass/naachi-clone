import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMongoRepository } from './repository.abstract';
import { MongoRepository } from './repository';
import { UserDocument } from 'src/modules/user/entity/user.entity';
import { IUser } from 'src/common/interfaces/user.interface';
import { User } from 'src/modules/user/entity/user.entity';

@Injectable()
export class MongoDBServices {
  user: IMongoRepository<UserDocument, IUser, UserDocument>;
  constructor(
    @InjectModel(User.name)
    private userRepository: Model<UserDocument>,
  ) {
    console.log('MongoDBServices loaded');
  }

  onApplicationBootstrap() {
    this.user = new MongoRepository<User, IUser, UserDocument>(
      this.userRepository,
    );
    console.log('<== Mongo DB repositories got initialised ==>');
  }
}
