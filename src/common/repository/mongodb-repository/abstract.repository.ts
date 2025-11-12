import { IMongoRepository } from './repository.abstract';
import { UsersDocument } from 'src/modules/users/entity/users.entity';
import { IUsers } from 'src/common/interfaces/users.interface';
import { Users } from 'src/modules/users/entity/users.entity';
import { SignupTempDocument } from 'src/modules/users/entity/signup-temp.entity';
import { SignupTemp } from 'src/modules/users/entity/signup-temp.entity';

export abstract class IMongoDBServices {
    abstract users: IMongoRepository<Users, IUsers, UsersDocument>;
    abstract signupTemp: IMongoRepository<SignupTemp, any, SignupTempDocument>;
}