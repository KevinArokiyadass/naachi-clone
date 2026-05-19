import { Injectable } from '@nestjs/common';
import { IMongoDBServices } from '../../../common/repository/mongodb-repository/abstract.repository';
import { ExistingUserLookupMaps, ExistingUserRecord } from './user-bulk-upload.types';

@Injectable()
export class UserBulkRepository {
  constructor(private readonly dbServices: IMongoDBServices) {}

  async findExistingByUniqueKeys(
    emails: string[],
    userNames: string[],
    phoneNumbers: string[],
  ): Promise<ExistingUserLookupMaps> {
    const projection = {
      userId: 1,
      email: 1,
      phoneNumber: 1,
      userName: 1,
      institutionsId: 1,
    };

    const [emailRows, userNameRows, phoneRows] = await Promise.all([
      emails.length
        ? this.dbServices.users.find({ email: { $in: emails }, isDeleted: false }, projection)
        : Promise.resolve([]),
      userNames.length
        ? this.dbServices.users.find({ userName: { $in: userNames }, isDeleted: false }, projection)
        : Promise.resolve([]),
      phoneNumbers.length
        ? this.dbServices.users.find(
            { phoneNumber: { $in: phoneNumbers }, isDeleted: false },
            projection,
          )
        : Promise.resolve([]),
    ]);

    const toRecord = (row: any): ExistingUserRecord => ({
      userId: row.userId,
      email: row.email,
      phoneNumber: row.phoneNumber,
      userName: row.userName,
      institutionsId: row.institutionsId,
    });

    return {
      byEmail: new Map(
        emailRows.filter((row) => row?.email).map((row) => [row.email, toRecord(row)]),
      ),
      byUserName: new Map(
        userNameRows.filter((row) => row?.userName).map((row) => [row.userName, toRecord(row)]),
      ),
      byPhoneNumber: new Map(
        phoneRows
          .filter((row) => row?.phoneNumber)
          .map((row) => [row.phoneNumber, toRecord(row)]),
      ),
    };
  }
}
