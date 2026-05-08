import { Injectable } from '@nestjs/common';
import { IMongoDBServices } from '../../../common/repository/mongodb-repository/abstract.repository';
import { ExistingAdminLookupMaps } from './admin-user-bulk-upload.types';

@Injectable()
export class AdminUserBulkRepository {
  constructor(private readonly dbServices: IMongoDBServices) {}

  async findExistingByUniqueKeys(emails: string[], userNames: string[], phoneNumbers: string[]): Promise<ExistingAdminLookupMaps> {
    const [emailRows, userNameRows, phoneRows] = await Promise.all([
      emails.length
        ? this.dbServices.adminUser.find(
            { email: { $in: emails }, isDeleted: { $ne: true } },
            { adminId: 1, email: 1 },
          )
        : Promise.resolve([]),
      userNames.length
        ? this.dbServices.adminUser.find(
            { userName: { $in: userNames }, isDeleted: { $ne: true } },
            { adminId: 1, userName: 1 },
          )
        : Promise.resolve([]),
      phoneNumbers.length
        ? this.dbServices.adminUser.find(
            { phoneNumber: { $in: phoneNumbers }, isDeleted: { $ne: true } },
            { adminId: 1, phoneNumber: 1 },
          )
        : Promise.resolve([]),
    ]);

    return {
      byEmail: new Map(emailRows.filter((row) => row?.email).map((row) => [row.email, row])),
      byUserName: new Map(userNameRows.filter((row) => row?.userName).map((row) => [row.userName, row])),
      byPhoneNumber: new Map(phoneRows.filter((row) => row?.phoneNumber).map((row) => [row.phoneNumber, row])),
    };
  }
}

