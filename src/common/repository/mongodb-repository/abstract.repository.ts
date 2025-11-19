import { IMongoRepository } from './repository.abstract';
import { UsersDocument } from 'src/modules/users/entity/users.entity';
import { IUsers } from 'src/common/interfaces/users.interface';
import { Users } from 'src/modules/users/entity/users.entity';
import { AdminUserDocument } from 'src/modules/admin-users/entities/admin-user.entity';
import { AdminUser } from 'src/modules/admin-users/entities/admin-user.entity';
import { IAdminUser } from 'src/common/interfaces/admin-user.interface';

export abstract class IMongoDBServices {
    abstract users: IMongoRepository<Users, IUsers, UsersDocument>;
    abstract adminUser: IMongoRepository<AdminUser, IAdminUser, AdminUserDocument>;
}