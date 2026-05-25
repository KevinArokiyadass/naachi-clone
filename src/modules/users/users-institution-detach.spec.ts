jest.mock('nanoid', () => ({
  customAlphabet: () => () => 'mock-nanoid',
  nanoid: () => 'mock-nanoid',
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersAuthService } from './users.service';

describe('UsersAuthService institution detach', () => {
  let service: UsersAuthService;

  const dbService = {
    users: {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    },
  };

  const httpClientService = {
    delete: jest.fn().mockResolvedValue({}),
  };

  const baseUser = {
    userId: 'user-1',
    institutionsId: 'inst-1',
    departmentsId: 'dept-1',
    isVerified: true,
    isDeleted: false,
    toObject: () => ({
      userId: 'user-1',
      institutionsId: 'inst-1',
      departmentsId: 'dept-1',
      isVerified: true,
    }),
  };

  beforeAll(() => {
    process.env.COGNITO_CUSTOMER_APP_CLIENT_ID = 'test-client';
    process.env.COGNITO_CUSTOMER_USER_POOL_ID = 'test-pool';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'key';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UsersAuthService(
      dbService as any,
      {} as any,
      {} as any,
      {} as any,
      { getCloudFrontUrl: (v: string) => v } as any,
      {} as any,
      {} as any,
      httpClientService as any,
    );
    service.onModuleInit = jest.fn().mockResolvedValue(undefined);
  });

  describe('removeUserFromInstitution', () => {
    it('unsets institution fields, clears isVerified, and removes user from institution groups', async () => {
      dbService.users.findOne.mockResolvedValue(baseUser);
      dbService.users.findOneAndUpdate.mockResolvedValue({
        userId: 'user-1',
        isVerified: false,
        isDeleted: false,
      });

      const result = await service.removeUserFromInstitution('user-1');

      expect(dbService.users.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-1', isDeleted: false },
        {
          $set: { isVerified: false, updatedAt: expect.any(Date) },
          $unset: { institutionsId: 1, departmentsId: 1 },
        },
        { new: true },
      );
      expect(httpClientService.delete).toHaveBeenCalledWith(
        'NAACHI_CHAT_SERVICE',
        '/group-member/user/user-1',
        { institutionsId: 'inst-1' },
      );
      expect(result.message).toBe('User removed from institution');
      expect(result.user.isVerified).toBe(false);
    });

    it('throws when user is not found', async () => {
      dbService.users.findOne.mockResolvedValue(null);
      await expect(service.removeUserFromInstitution('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws when user has no institution', async () => {
      dbService.users.findOne.mockResolvedValue({ userId: 'user-2', isDeleted: false });
      await expect(service.removeUserFromInstitution('user-2')).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkRemoveUsersFromInstitution', () => {
    it('detaches institution users and skips users without institutionsId', async () => {
      dbService.users.findOne
        .mockResolvedValueOnce(baseUser)
        .mockResolvedValueOnce({ userId: 'user-2', isDeleted: false })
        .mockResolvedValueOnce(null);

      dbService.users.findOneAndUpdate.mockResolvedValue({
        ...baseUser,
        institutionsId: undefined,
        departmentsId: undefined,
        isVerified: false,
      });

      const result = await service.bulkRemoveUsersFromInstitution(['user-1', 'user-2', 'user-3']);

      expect(result.removedCount).toBe(1);
      expect(result.skipped).toEqual([
        { userId: 'user-2', reason: 'User is not associated with any institution' },
        { userId: 'user-3', reason: 'User not found' },
      ]);
      expect(httpClientService.delete).toHaveBeenCalledTimes(1);
    });

    it('throws when no user IDs provided', async () => {
      await expect(service.bulkRemoveUsersFromInstitution([])).rejects.toThrow(BadRequestException);
    });
  });
});
