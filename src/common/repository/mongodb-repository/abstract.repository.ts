
import { IMongoRepository } from './repository.abstract';
import { UserDocument } from 'src/modules/user/entity/user.entity';
import { IUser } from 'src/common/interfaces/user.interface';
import { User } from 'src/modules/user/entity/user.entity';

export abstract class IMongoDBServices {
    abstract user: IMongoRepository<User, IUser, UserDocument>;
}