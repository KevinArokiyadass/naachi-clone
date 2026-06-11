import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AdminUpdateUserAttributesCommand,
  AdminDeleteUserAttributesCommand,
  AdminDeleteUserCommand,
  AdminUserGlobalSignOutCommand,
  AuthFlowType,
  CognitoIdentityProviderClient,
  GetUserAttributeVerificationCodeCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  SignUpCommand,
  SignUpCommandInput,
  VerifyUserAttributeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { JwtService } from '@nestjs/jwt';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { IUsers } from 'src/common/interfaces/users.interface';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { ReferrerMedium, USER_STATUS } from 'src/common/enums/user.enum';
import {
  generateRandomPassword,
  generateUniqueId,
  generateReferralCodeString,
  generateUniqueTemporaryUserName,
} from 'src/common/utils/util';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import {
  ChangeUsernameDto,
  ConfirmEmailDto,
  SetUsernameDto,
  UsersLoginDto,
  UsersSignupDto,
  UsersVerifyLoginDto,
  UsersVerifySignupDto,
  VerifyEmailDto,
  UnifiedPhoneOtpRequestDto,
  UnifiedPhoneOtpVerifyDto,
} from './dto/users-auth.dto';
import { RecordService } from '@noukha-technologies/mdm-core';
import { response } from 'express';
import { UpdateUserProfileDto } from './dto/user-profile.dto';
import { AwsStoreService } from '../aws-store/aws-store.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Workbook } from 'exceljs';
import { assertInstitutionUploadScope } from 'src/common/utils/institution-scope.util';
import {
  buildPhoneLookupKeys,
  PHONE_SUFFIX_LENGTHS,
} from './utils/normalize-phone-lookup.util';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';


@Injectable()
export class UsersAuthService implements OnModuleInit {
  private readonly logger = new Logger(UsersAuthService.name);
  private cognitoClient: CognitoIdentityProviderClient;
  private readonly clientId = process.env.COGNITO_CUSTOMER_APP_CLIENT_ID;
  private readonly userPoolId = process.env.COGNITO_CUSTOMER_USER_POOL_ID;
  private readonly DEFAULT_EMAIL_OTP = '643211';

  constructor(
    private readonly dbService: IMongoDBServices,
    private readonly jwtService: JwtService,
    private readonly paginationService: PaginationService,
    private readonly recordService: RecordService,
    private readonly awsStoreService: AwsStoreService,
    private readonly configurationService: ConfigurationService,
    @InjectConnection() private readonly connection: Connection,
    private readonly httpClientService: HttpClientService,
  ) {
    if (!this.clientId) {
      throw new Error('COGNITO_CUSTOMER_APP_CLIENT_ID is not configured');
    }
    if (!this.userPoolId) {
      throw new Error('COGNITO_CUSTOMER_USER_POOL_ID is not configured');
    }
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureFindFriendsIndexes();
  }

  private async generateUniqueReferralCode(): Promise<string> {
    let referralCode: string = '';
    let isUnique = false;
    while (!isUnique) {
      referralCode = generateReferralCodeString();
      const existingUser = await this.dbService.users.findOne({ referralCode });
      if (!existingUser) {
        isUnique = true;
      }
    }
    return referralCode;
  }

  async getOrCreateReferralCode(userId: string): Promise<string> {
    const user = await this.dbService.users.findOne({ userId, isDeleted: false });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.referralCode) {
      return user.referralCode;
    }
    const newCode = await this.generateUniqueReferralCode();
    await this.dbService.users.findOneAndUpdate({ userId: { $eq: userId } }, { referralCode: newCode, updatedAt: new Date() });
    return newCode;
  }

  async backfillReferralCodes() {
    const users = await this.dbService.users.find({
      $or: [{ referralCode: { $exists: false } }, { referralCode: null }],
      isDeleted: false,
    });

    let count = 0;
    for (const user of users) {
      const code = await this.generateUniqueReferralCode();
      await this.dbService.users.findOneAndUpdate(
        { userId: user.userId },
        { referralCode: code, updatedAt: new Date() },
      );
      count++;
    }
    return { message: `Backfilled ${count} users with referral codes` };
  }

  async signup(dto: UsersSignupDto) {
    if (dto.referredBy) {
      const referrer = await this.dbService.users.findOne({ referralCode: { $eq: dto.referredBy }, isDeleted: false });
      if (!referrer) {
        throw new BadRequestException('Invalid referral code');
      }
      if (referrer.status !== USER_STATUS.ACTIVE) {
        throw new BadRequestException('Referrer user is not active');
      }
      dto.referredBy = referrer.userId;
    }
    // Check signup restrictions before proceeding
    await this.checkSignupRestrictions();

    await this.ensurePhoneAvailable(dto.phoneNumber);

    const effectiveMedium = (dto.referredBy ? ReferrerMedium.REFERRAL_CODE : undefined);

    const userPayload: IUsers = {
      userId: generateUniqueId(),
      phoneNumber: dto.phoneNumber,
      isVerified: false,
      isDeleted: false,
      status: USER_STATUS.PENDING,
      phoneVerified: false,
      userNameSet: false,
      emailVerified: false,
      isReferralVerified: false,
      qrAuth: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      referralCode: await this.generateUniqueReferralCode(),
      referredBy: dto.referredBy,
      referrerMedium: effectiveMedium,
    };

    try {
      await this.signUpUserInCognito(dto.phoneNumber, userPayload.userId);
    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        // Existing Cognito user (including previously deleted local users):
        // treat as a fresh signup in our system, not as an already active user.
        const syncUserPayload: IUsers = {
          userId: generateUniqueId(),
          phoneNumber: dto.phoneNumber,
          customLogin: true,
          status: USER_STATUS.PENDING,
          isVerified: false,
          phoneVerified: false,
          userNameSet: false,
          emailVerified: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          referralCode: await this.generateUniqueReferralCode(),
          referredBy: dto.referredBy,
          referrerMedium: effectiveMedium,
        };

        const otpResponse = await this.generateOtp(dto.phoneNumber);
        await this.dbService.users.create(syncUserPayload);

        return {
          message: 'User synchronized and OTP sent to phone number',
          challengeName: otpResponse.ChallengeName,
          session: otpResponse.Session,
          userId: syncUserPayload.userId,
        };
      }
      this.handleCognitoSignupError(error);
    }

    const otpResponse = await this.generateOtp(dto.phoneNumber);

    await this.dbService.users.create(userPayload);

    return {
      message: 'OTP sent to phone number',
      challengeName: otpResponse.ChallengeName,
      session: otpResponse.Session,
      userId: userPayload.userId,
    };
  }

  async verifySignupOtp(dto: UsersVerifySignupDto) {
    const user = await this.getUserOrThrow(dto.phoneNumber);

    let response;
    try {
      response = await this.respondToOtpChallenge(
        dto.phoneNumber,
        dto.otp,
        dto.session,
      );
    } catch (error) {
      this.handleOtpChallengeError(error);
    }

    const tokens = this.extractAuthResult(response);

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { phoneNumber: dto.phoneNumber, isDeleted: false },
      {
        phoneVerified: true,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    );

    return {
      message: 'Phone number verified successfully',
      tokens,
      user: this.attachProfileImageUrl(updatedUser ?? user),
    };
  }


  async requestLoginOtp(dto: UsersLoginDto) {
    const user = await this.getUserOrThrow(dto.phoneNumber);

    if (user.status !== USER_STATUS.ACTIVE) {
      throw new BadRequestException(
        'Complete email verification before logging in.',
      );
    }

    const otpResponse = await this.generateOtp(dto.phoneNumber);

    return {
      message: 'OTP sent to phone number',
      challengeName: otpResponse.ChallengeName,
      session: otpResponse.Session,
    };
  }

  async verifyLoginOtp(dto: UsersVerifyLoginDto) {
    const user = await this.getUserOrThrow(dto.phoneNumber);

    if (user.status !== USER_STATUS.ACTIVE) {
      throw new BadRequestException(
        'Complete email verification before logging in.',
      );
    }

    let response;
    try {
      response = await this.respondToOtpChallenge(
        dto.phoneNumber,
        dto.otp,
        dto.session,
      );
    } catch (error) {
      this.handleOtpChallengeError(error);
    }

    const tokens = this.extractAuthResult(response);

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { phoneNumber: dto.phoneNumber, isDeleted: false },
      {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true },
    );

    const loginUser = this.attachProfileImageUrl(updatedUser ?? user);

    return {
      message: 'Login successful',
      tokens,
      user: loginUser,
      requiresUsernameChange: Boolean(loginUser?.isTemporaryUserName),
    };
  }

  async requestUnifiedPhoneOtp(dto: UnifiedPhoneOtpRequestDto) {
    const { phoneNumber } = dto;

    const existingUser = await this.dbService.users.findOne({
      phoneNumber,
      isDeleted: false,
    });

    if (!existingUser) {
      // Check signup restrictions before allowing new signup
      await this.checkSignupRestrictions();

      const signupResult = await this.signup({ phoneNumber, referredBy: dto.referredBy } as UsersSignupDto);

      return {
        authMode: 'signup',
        ...signupResult,
      };
    }

    // Block inactive/blocked users from logging in
    if (existingUser.status === USER_STATUS.BLOCKED) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact support for assistance.',
      );
    }

    // Existing user - check if they can continue signup or should login
    if (existingUser.status === USER_STATUS.ACTIVE) {
      // Active users can always login
      const loginResult = await this.requestLoginOtp({ phoneNumber } as UsersLoginDto);

      return {
        authMode: 'login',
        ...loginResult,
      };
    }

    // Existing user but not active - check restrictions before allowing them to continue signup
    await this.checkSignupRestrictions();

    if (existingUser.phoneVerified) {
      const reverifyPhone = await this.generateOtp(phoneNumber);
      return {
        authMode: 'signup',
        message: 'reverifying Phone continue signup',
        userId: existingUser.userId,
        challengeName: reverifyPhone.ChallengeName,
        session: reverifyPhone.Session
      };
    }

    const otpResponse = await this.generateOtp(phoneNumber);

    return {
      authMode: 'signup',
      message: 'OTP sent to phone number',
      challengeName: otpResponse.ChallengeName,
      session: otpResponse.Session,
      userId: existingUser.userId,
    };
  }

  async verifyUnifiedPhoneOtp(dto: UnifiedPhoneOtpVerifyDto) {
    const { phoneNumber, otp, session, deviceId } = dto;

    const user = await this.dbService.users.findOne({
      phoneNumber,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Block inactive/blocked users from logging in
    if (user.status === USER_STATUS.BLOCKED) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact support for assistance.',
      );
    }

    // Single-device login logic
    if (deviceId) {
      if (user.deviceId && user.deviceId !== deviceId) {
        // This is a new device login; globally sign out the previous device
        try {
          await this.cognitoClient.send(
            new AdminUserGlobalSignOutCommand({
              UserPoolId: this.userPoolId,
              Username: phoneNumber,
            }),
          );
        } catch (error) {
          console.error('Failed to globally sign out previous device in Cognito:', error);
        }
      }

      // Update the device token in the database if it changed or is new
      if (user.deviceId !== deviceId) {
        await this.dbService.users.findOneAndUpdate(
          { userId: { $eq: user.userId } },
          { deviceId, updatedAt: new Date() }
        );
      }
    }

    if (user.status === USER_STATUS.ACTIVE) {
      const loginResult = await this.verifyLoginOtp({
        phoneNumber,
        otp,
        session,
      } as UsersVerifyLoginDto);

      return {
        authMode: 'login',
        ...loginResult,
      };
    }


    const signupResult = await this.verifySignupOtp({
      phoneNumber,
      otp,
      session,
    } as UsersVerifySignupDto);

    return {
      authMode: 'signup',
      nextStep: 'setUsername',
      message: 'Phone verified successfully. Continue signup.',
      userId: signupResult.user?.userId ?? user.userId,
      referralCode: signupResult.user?.referralCode ?? user.referralCode,
      tokens: signupResult.tokens,
    };
  }

  async resendUnifiedPhoneOtp(dto: UnifiedPhoneOtpRequestDto) {
    const { phoneNumber } = dto;

    const user = await this.dbService.users.findOne({
      phoneNumber,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Block inactive/blocked users from resending OTP
    if (user.status === USER_STATUS.BLOCKED) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact support for assistance.',
      );
    }

    if (user.status === USER_STATUS.ACTIVE) {
      const loginResult = await this.requestLoginOtp({ phoneNumber } as UsersLoginDto);
      return {
        authMode: 'login',
        ...loginResult,
      };
    }

    await this.resendSignupOtp(phoneNumber);
    return {
      authMode: 'signup',
      message: 'OTP resent successfully',
      userId: user.userId,
    };
  }

  async checkAvailableUserName(userName: string) {
    const user = await this.dbService.users.findOne({
      userName,
      isDeleted: false
    });
    if (user) {
      throw new BadRequestException('Username already taken');
    }
    return {
      message: 'Username available'
    };
  }

  async setUsername(dto: SetUsernameDto) {
    const user = await this.dbService.users.findOne({
      userId: dto.userId,
      isDeleted: false
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phoneVerified) {
      throw new BadRequestException('Phone number must be verified first');
    }

    if (user.status !== USER_STATUS.PENDING) {
      throw new BadRequestException('User signup is already completed');
    }


    const existingUser = await this.dbService.users.findOne({
      userName: dto.userName,
      isDeleted: false
    });

    if (existingUser && existingUser.userId !== dto.userId) {
      throw new BadRequestException('Username already taken');
    }


    await this.dbService.users.findOneAndUpdate(
      { userId: { $eq: dto.userId }, status: USER_STATUS.PENDING },
      {
        userName: dto.userName,
        name: dto.name,
        userNameSet: true,
        updatedAt: new Date()
      }
    );

    return {
      message: 'Username set successfully'
    };
  }

  async changeUsername(dto: ChangeUsernameDto) {
    const user = await this.dbService.users.findOne({
      userId: dto.userId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      throw new BadRequestException('User account is not active');
    }

    const newUserName = dto.userName.trim();

    if (user.userName === newUserName) {
      throw new BadRequestException(
        user.isTemporaryUserName
          ? 'Choose a new username different from your temporary username'
          : 'Username is already set to this value',
      );
    }

    const existingUser = await this.dbService.users.findOne({
      userName: newUserName,
      isDeleted: false,
    });

    if (existingUser && existingUser.userId !== dto.userId) {
      throw new BadRequestException('Username already taken');
    }

    await this.dbService.users.findOneAndUpdate(
      { userId: dto.userId, isDeleted: false },
      {
        userName: newUserName,
        userNameSet: true,
        isTemporaryUserName: false,
        updatedAt: new Date(),
      },
    );

    return {
      message: 'Username changed successfully',
      requiresUsernameChange: false,
    };
  }

  async validateInstitute(email: string): Promise<string> {
    const atIndex = email?.lastIndexOf('@') ?? -1;
    if (atIndex === -1 || atIndex === email.length - 1) {
      throw new BadRequestException('Invalid email format');
    }

    const domain = email.substring(atIndex + 1).trim().replace(/^@/, '').toLowerCase();

    try {
      // Search for domain with or without @ prefix to handle both cases in database
      const response = await this.recordService.findAll('institutions', {
        filters: {
          $or: [
            { institutionDomain: domain },
            { institutionDomain: `@${domain}` }
          ],
        },
        fields: ['institutionDomain', 'institutionsId'],
        nonPaginated: true,
      });

      const hasMatch = Array.isArray(response?.items) && response.items.length > 0;

      if (!hasMatch) {
        throw new BadRequestException({
          message: `Email domain is not a registered domain.`,
          errorCode: 'INVALID_EMAIL_DOMAIN',
        });
      }

      const matchingInstitution = response.items[0];
      if (!matchingInstitution?.institutionsId) {
        throw new BadRequestException({
          message: 'Institution ID not found for the matching domain.',
          errorCode: 'INSTITUTION_ID_MISSING',
        });
      }

      return matchingInstitution.institutionsId;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException({
        message: 'Failed to validate email domain. Please try again.',
        errorCode: 'DOMAIN_VALIDATION_ERROR',
      });
    }
  }

  validateInstitutionScope(
    institutionsId: string,
    requestContext: { institutionsId?: string; isSuperAdminRequest?: boolean },
  ): void {
    assertInstitutionUploadScope(institutionsId, requestContext);
  }

  async assertBulkUploadUserLimitNotExceeded(
    options?: { projectedNewUsers?: number },
  ): Promise<void> {
    await this.checkSignupRestrictions('bulk-upload', {
      additionalUsers: options?.projectedNewUsers,
    });
  }

  async createInstitutionManagedUser(payload: {
    institutionsId: string;
    departmentsId?: string;
    name: string;
    phoneNumber: string;
    email?: string;
    userName?: string;
    status?: 'active' | 'blocked' | 'pending';
  }): Promise<{ userId: string }> {
    await this.checkSignupRestrictions('institution-managed', {
      additionalUsers: 1,
    });

    const phoneNumber = payload.phoneNumber.trim();
    const email = payload.email?.trim().toLowerCase();
    const providedUserName = payload.userName?.trim();
    const userName =
      providedUserName ||
      (await generateUniqueTemporaryUserName(payload.name, this.dbService));
    const isTemporaryUserName = !providedUserName;

    const institution = await this.recordService.findOne('institutions', payload.institutionsId);
    if (!institution) {
      throw new BadRequestException('Institution not found');
    }

    const [existingByPhone, existingByEmail, existingByUserName] = await Promise.all([
      this.dbService.users.findOne({ phoneNumber: { $eq: phoneNumber }, isDeleted: false }),
      email ? this.dbService.users.findOne({ email: { $eq: email }, isDeleted: false }) : Promise.resolve(null),
      userName ? this.dbService.users.findOne({ userName: { $eq: userName }, isDeleted: false }) : Promise.resolve(null),
    ]);

    if (existingByPhone) {
      throw new BadRequestException('User with this phone number already exists');
    }
    if (existingByEmail) {
      throw new BadRequestException('User with this email already exists');
    }
    if (existingByUserName) {
      throw new BadRequestException('User with this username already exists');
    }

    const userId = generateUniqueId();
    const referredBy = await this.getInstitutionDisplayName(payload.institutionsId);

    try {
      await this.signUpUserInCognito(phoneNumber, userId);
    } catch (error: any) {
      if (error?.name === 'UsernameExistsException') {
        // Auto-heal: delete the orphaned/stuck Cognito record and retry signup once
        try {
          await this.cognitoClient.send(
            new AdminDeleteUserCommand({
              UserPoolId: this.userPoolId,
              Username: phoneNumber,
            })
          );
          await this.signUpUserInCognito(phoneNumber, userId);
        } catch (retryErr: any) {
          throw new BadRequestException(
            `User with this phone number already exists in authentication provider and could not be reset: ${retryErr.message || retryErr.name}`,
          );
        }
      } else {
        throw error;
      }
    }

    const adminSyncResult = email ? await this.syncInstitutionIdFromAdminUser(email) : null;

    await this.dbService.users.create({
      userId,
      name: payload.name.trim(),
      phoneNumber,
      email,
      userName,
      userNameSet: true,
      isTemporaryUserName,
      status: payload.status || USER_STATUS.ACTIVE,
      isVerified: Boolean(adminSyncResult?.emailMatched),
      isDeleted: false,
      phoneVerified: true,
      emailVerified: Boolean(email),
      institutionsId: payload.institutionsId,
      departmentsId: payload.departmentsId,
      customLogin: false,
      referrerMedium: ReferrerMedium.BULK_UPLOAD_INSTITUTION || ReferrerMedium.INSTITUTION_MAIL,
      referredBy: referredBy || undefined,
      qrAuth: false,
      referralCode: await this.generateUniqueReferralCode(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { userId };
  }

  async updateInstitutionManagedUser(
    userId: string,
    payload: {
      institutionsId: string;
      departmentsId?: string;
      name: string;
      email?: string;
      userName?: string;
      status?: 'active' | 'blocked' | 'pending';
    },
  ): Promise<void> {
    const user = await this.dbService.users.findOne({ userId, isDeleted: false });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.institutionsId && user.institutionsId !== payload.institutionsId) {
      throw new ForbiddenException('Cannot update a user from another institution');
    }

    const email = payload.email?.trim().toLowerCase();
    const providedUserName = payload.userName?.trim();
    let resolvedUserName = providedUserName || user.userName;
    let isTemporaryUserName = user.isTemporaryUserName ?? false;

    if (!resolvedUserName) {
      resolvedUserName = await generateUniqueTemporaryUserName(
        payload.name,
        this.dbService,
      );
      isTemporaryUserName = true;
    } else if (providedUserName) {
      isTemporaryUserName = false;
    }

    if (email && email !== user.email) {
      const existingByEmail = await this.dbService.users.findOne({
        email: { $eq: email },
        userId: { $ne: userId },
        isDeleted: false,
      });
      if (existingByEmail) {
        throw new BadRequestException('User with this email already exists');
      }
    }

    if (resolvedUserName && resolvedUserName !== user.userName) {
      const existingByUserName = await this.dbService.users.findOne({
        userName: { $eq: resolvedUserName },
        userId: { $ne: userId },
        isDeleted: false,
      });
      if (existingByUserName) {
        throw new BadRequestException('User with this username already exists');
      }
    }

    const adminSyncResult = email
      ? await this.syncInstitutionIdFromAdminUser(email)
      : null;
    const isVerified = adminSyncResult?.emailMatched
      ? true
      : (user.isVerified ?? false);

    await this.dbService.users.findOneAndUpdate(
      { userId, isDeleted: false },
      {
        name: payload.name.trim(),
        email,
        userName: resolvedUserName,
        userNameSet: true,
        isTemporaryUserName,
        status: payload.status || USER_STATUS.ACTIVE,
        institutionsId: payload.institutionsId,
        departmentsId: payload.departmentsId,
        isVerified,
        phoneVerified: true,
        emailVerified: Boolean(email),
        referrerMedium: user.referrerMedium|| ReferrerMedium.BULK_UPLOAD_INSTITUTION,
        referredBy: await this.getInstitutionDisplayName(payload.institutionsId),
        updatedAt: new Date(),
      },
      { new: true },
    );
  }

  async getBulkUploadOptions(institutionsId: string): Promise<{
    institutionsId: string;
    departments: Array<{ departmentName: string; departmentsId: string }>;
  }> {
    const departmentsResult = await this.recordService.findAll('departments', {
      filters: {
        institutionsId,
        isDeleted: false,
        isActive: true,
      },
      fields: ['departmentName', 'departmentsId'],
      nonPaginated: true,
    });

    return {
      institutionsId,
      departments: (departmentsResult?.items || []).map((item: any) => ({
        departmentName: item.departmentName,
        departmentsId: item.departmentsId,
      })),
    };
  }

  async getInstitutionBulkUploadTemplate(
    institutionsId: string,
  ): Promise<{ fileName: string; fileBuffer: Buffer }> {
    const options = await this.getBulkUploadOptions(institutionsId);
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('StudentsBulkUpload');
    const master = workbook.addWorksheet('MasterData');

    sheet.addRow(['name', 'phoneNumber', 'email', 'select department']);
    sheet.addRow([
      'John Student',
      '+919344605885',
      'john.student@example.com',
      options.departments[0]?.departmentName || '',
    ]);
    sheet.columns = [
      { width: 28 },
      { width: 25, style: { numFmt: '@' } },
      { width: 34 },
      { width: 28 },
    ];
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    master.getCell('A1').value = 'DepartmentName';
    options.departments.forEach((department, index) => {
      master.getCell(`A${index + 2}`).value = department.departmentName;
    });
    master.state = 'veryHidden';

    const maxValidatedRows = 100;
    for (let row = 2; row <= maxValidatedRows; row++) {
      sheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['MasterData!$A$2:$A$500'],
      };
    }

    const notes = workbook.addWorksheet('Notes');
    notes.addRows([
      ['Rule', 'Details'],
      ['Institution', `Template generated for institutionsId: ${institutionsId}`],
      ['Phone', 'Compulsory: Must start with "+" (e.g. +919344605885). Tip: Type a single quote (\') before the + in Excel to prevent formula conversion.'],
      ['Email', 'Compulsory: Must be a valid, unique email address'],
      ['Department', 'Compulsory: Select from the pre-populated dropdown list'],
      ['Status', 'All uploaded users default to Active automatically'],
    ]);
    notes.columns = [{ width: 20 }, { width: 90 }];

    const fileName = `institution-student-bulk-upload-template-${institutionsId}.xlsx`;
    const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { fileName, fileBuffer };
  }

  private async getInstitutionDisplayName(institutionsId: string): Promise<string | null> {
    try {
      const institution = await this.recordService.findOne('institutions', institutionsId);
      if (!institution) {
        return null;
      }
      const institutionObj = institution.toObject ? institution.toObject() : institution;
      return institutionObj?.institutionName || null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves whether a user's email belongs to an admin in Admin Management.
   * Email match alone drives `isVerified`; `institutionId` is optional (from admin metaTags).
   */
  private async syncInstitutionIdFromAdminUser(
    email: string,
  ): Promise<{ emailMatched: true; institutionId?: string } | null> {
    const adminUser = await this.dbService.adminUser.findOne({
      email: { $eq: email.toLowerCase().trim() },
      isDeleted: { $ne: true },
    });

    if (!adminUser) {
      return null;
    }

    const institutionId = adminUser.metaTags?.[0]?.institutionsId;
    return institutionId
      ? { emailMatched: true, institutionId }
      : { emailMatched: true };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.dbService.users.findOne({
      userId: dto.userId,
      isDeleted: false
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phoneVerified) {
      throw new BadRequestException('Phone number must be verified first');
    }

    if (!user.userNameSet || !user.userName) {
      throw new BadRequestException('Username must be set first');
    }

    const existingUser = await this.dbService.users.findOne({
      email: { $eq: dto.email },
      isDeleted: false,
      status: USER_STATUS.ACTIVE
    });

    if (existingUser && existingUser.userId !== dto.userId) {
      throw new BadRequestException('Email already registered');
    }

    // Check for matching admin user and sync institutionId
    const adminSyncResult = await this.syncInstitutionIdFromAdminUser(dto.email);

    // Validate institution domain if not an admin user
    if (!adminSyncResult?.emailMatched) {
      await this.validateInstitute(dto.email);
    }

    const updatePayload: Record<string, any> = {
      email: dto.email,
      emailVerified: false,
      qrAuth: false,
      updatedAt: new Date()
    };

    // Only set referrerMedium during initial signup flow when it is not already set
    if (!user.referrerMedium && user.status === USER_STATUS.PENDING) {
      updatePayload.referrerMedium = ReferrerMedium.INSTITUTION_MAIL;
    }

    await this.dbService.users.findOneAndUpdate(
      { userId: dto.userId, isDeleted: false },
      updatePayload
    );


    try {
      await this.cognitoClient.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: this.userPoolId,
          Username: user.phoneNumber,
          UserAttributes: [
            { Name: 'email', Value: dto.email },
            { Name: 'email_verified', Value: 'false' }
          ]
        })
      );
    } catch (error) {
      console.error('Failed to update email in Cognito:', error);
      throw new BadRequestException('Failed to update email. Please try again.');
    }

    try {
      await this.cognitoClient.send(
        new GetUserAttributeVerificationCodeCommand({
          AccessToken: dto.accessToken,
          AttributeName: 'email'
        })
      );
    } catch (error) {
      console.error('Failed to request email verification code:', error);
      throw new BadRequestException('Failed to send verification code. Please try again.');
    }

    return {
      message: 'Verification code sent to your email'
    };
  }

  async confirmEmail(dto: ConfirmEmailDto) {
    const user = await this.dbService.users.findOne({
      userId: dto.userId,
      isDeleted: false
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.phoneVerified) {
      throw new BadRequestException('Phone number must be verified first');
    }

    if (!user.userNameSet) {
      throw new BadRequestException('Username must be set first');
    }

    if (user.email !== dto.email) {
      throw new BadRequestException('Email does not match the one provided during verification');
    }

    // Check for matching admin user and sync institutionId
    const adminSyncResult = await this.syncInstitutionIdFromAdminUser(dto.email);

    const institutionsId = adminSyncResult?.institutionId || await this.validateInstitute(dto.email);

    // Check if default OTP is used
    if (dto.confirmationCode === this.DEFAULT_EMAIL_OTP) {
      const isPendingSignup = user.status === USER_STATUS.PENDING;

      const updatePayload: Record<string, any> = {
        emailVerified: true,
        institutionsId: institutionsId,
        updatedAt: new Date()
      };

      if (adminSyncResult?.emailMatched) {
        updatePayload.isVerified = true;
      }

      if (isPendingSignup) {
        updatePayload.status = USER_STATUS.ACTIVE;
        updatePayload.isVerified = adminSyncResult?.emailMatched
          ? true
          : (user.isVerified ?? false);

        // Only set referrerMedium during initial signup flow when it is not already set
        if (!user.referrerMedium) {
          updatePayload.referrerMedium = ReferrerMedium.INSTITUTION_MAIL;
        }

        updatePayload.qrAuth = false;
      }

      // Skip Cognito verification and directly mark as completed (or just mark emailVerified for existing users)
      await this.dbService.users.findOneAndUpdate(
        { userId: dto.userId, isDeleted: false },
        updatePayload
      );

      return {
        message: 'Email verified successfully. Signup completed!'
      };
    }

    // Proceed with Cognito verification for non-default OTP
    try {
      await this.cognitoClient.send(
        new VerifyUserAttributeCommand({
          AccessToken: dto.accessToken,
          AttributeName: 'email',
          Code: dto.confirmationCode
        })
      );
    } catch (error) {
      console.error('Failed to verify email code:', error);
      if (error.name === 'CodeMismatchException') {
        throw new UnauthorizedException('Invalid verification code');
      }
      if (error.name === 'ExpiredCodeException') {
        throw new UnauthorizedException('Verification code has expired. Please request a new one.');
      }
      throw new BadRequestException('Failed to verify email. Please try again.');
    }

    const isPendingSignup = user.status === USER_STATUS.PENDING;

    const updatePayload: Record<string, any> = {
      emailVerified: true,
      institutionsId: institutionsId,
      updatedAt: new Date()
    };

    if (adminSyncResult?.emailMatched) {
      updatePayload.isVerified = true;
    }

    if (isPendingSignup) {
      updatePayload.status = USER_STATUS.ACTIVE;
      updatePayload.isVerified = adminSyncResult?.emailMatched
        ? true
        : (user.isVerified ?? false);

      // Only set referrerMedium during initial signup flow when it is not already set
      if (!user.referrerMedium) {
        updatePayload.referrerMedium = ReferrerMedium.INSTITUTION_MAIL;
      }

      updatePayload.qrAuth = false;
    }

    await this.dbService.users.findOneAndUpdate(
      { userId: dto.userId, isDeleted: false },
      updatePayload
    );

    return {
      message: 'Email verified successfully. Signup completed!'
    };
  }


  async resendSignupOtp(phoneNumber: string) {
    await this.getUserOrThrow(phoneNumber);

    const command = new ResendConfirmationCodeCommand({
      ClientId: this.clientId,
      Username: phoneNumber,
    });

    await this.cognitoClient.send(command);

    return { message: 'OTP resent successfully' };
  }

  async refreshToken(refreshToken: string) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await this.cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('Failed to refresh token');
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(accessToken: string, refreshToken: string) {
    try {
      await this.cognitoClient.send(
        new RevokeTokenCommand({
          ClientId: this.clientId,
          Token: refreshToken,
        }),
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
    }

    try {
      await this.cognitoClient.send(
        new GlobalSignOutCommand({
          AccessToken: accessToken,
        }),
      );
    } catch {
    }

    return { message: 'Signed out successfully' };
  }

  async generateAppJwt(userId: string) {
    const user = await this.dbService.users.findOne({
      userId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Block inactive/blocked users from generating JWT tokens
    if (user.status === USER_STATUS.BLOCKED) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact support for assistance.',
      );
    }

    const payload: Record<string, any> = {
      userId: user.userId,
      phoneNumber: user.phoneNumber,
      iat: Math.floor(Date.now() / 1000),
    };

    if (user.email) {
      payload.email = user.email;
    }

    if (user.userName) {
      payload.userName = user.userName;
    }

    const token = await this.jwtService.signAsync(payload);

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: '365d',
      user: this.attachProfileImageUrl(user),
    };
  }

  private async signUpUserInCognito(phoneNumber: string, userId: string) {
    const params: SignUpCommandInput = {
      Username: phoneNumber,
      UserAttributes: [
        { Name: 'phone_number', Value: phoneNumber },
        { Name: 'custom:userId', Value: userId },
      ],
      Password: generateRandomPassword(),
      ClientId: this.clientId,
    };

    const command = new SignUpCommand(params);
    await this.cognitoClient.send(command);
  }

  private async generateOtp(phoneNumber: string) {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.CUSTOM_AUTH,
      AuthParameters: {
        USERNAME: phoneNumber,
      },
      ClientId: this.clientId,
    });

    return this.cognitoClient.send(command);
  }

  private async respondToOtpChallenge(
    phoneNumber: string,
    otp: string,
    session?: string,
  ) {
    const command = new RespondToAuthChallengeCommand({
      ChallengeName: 'CUSTOM_CHALLENGE',
      ClientId: this.clientId,
      ChallengeResponses: {
        USERNAME: phoneNumber,
        ANSWER: otp,
      },
      Session: session,
    });

    return this.cognitoClient.send(command);
  }

  private extractAuthResult(response: any) {
    if (
      response.ChallengeName === 'CUSTOM_CHALLENGE' &&
      response.Session
    ) {
      throw new BadRequestException({
        message: 'Invalid OTP. Please double-check the code and try again.',
        errorCode: 'INVALID_OTP_RETRY_SAME_CODE',
        session: response.Session,
        challengeName: response.ChallengeName,
        retryAllowed: true,
        persistentOTP: true,
      });
    }

    if (!response.AuthenticationResult) {
      throw new BadRequestException('Unexpected authentication response');
    }

    return response.AuthenticationResult;
  }

  private handleOtpChallengeError(error: any) {
    const name = error?.name;
    if (name === 'NotAuthorizedException' || name === 'CodeMismatchException') {
      throw new BadRequestException({
        message: 'Invalid OTP. Please double-check the code and try again.',
        errorCode: 'INVALID_OTP_CODE',
      });
    }

    throw new BadRequestException('Invalid OTP. Please double-check the code and try again.');
  }

  private handleCognitoSignupError(error: any) {
    const name = error?.name;
    const message = error?.message || '';

    if (name === 'InvalidParameterException') {
      if (message.includes('phone number') || message.includes('phone_number')) {
        throw new BadRequestException({
          message: 'Invalid phone number format. Please provide a valid phone number.',
          errorCode: 'INVALID_PHONE_FORMAT',
        });
      }
      throw new BadRequestException({
        message: message || 'Invalid parameters provided.',
        errorCode: 'INVALID_PARAMETERS',
      });
    }

    if (name === 'UsernameExistsException') {
      throw new BadRequestException({
        message: 'Phone number already registered.',
        errorCode: 'PHONE_ALREADY_EXISTS',
      });
    }

    throw error;
  }

  private async ensurePhoneAvailable(phoneNumber: string) {
    const existing = await this.dbService.users.findOne({
      phoneNumber: { $eq: phoneNumber },
      isDeleted: false,
    });

    if (existing) {
      throw new BadRequestException('Phone number already registered');
    }
  }

  private async getUserOrThrow(phoneNumber: string) {
    const user = await this.dbService.users.findOne({
      phoneNumber: { $eq: phoneNumber },
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async checkSignupRestrictions(
    context: 'signup' | 'institution-managed' | 'bulk-upload' = 'signup',
    options?: { additionalUsers?: number },
  ): Promise<void> {
    const config = await this.configurationService.getConfiguration();

    if (!config.forceRestrictOnboarding) {
      return;
    }

    const allowedUserCount = Number(config.allowedUserCount);
    if (!Number.isFinite(allowedUserCount) || allowedUserCount < 0) {
      this.logger.warn(
        `[User Limit Check] Skipping ${context}: invalid allowedUserCount=${config.allowedUserCount}`,
      );
      return;
    }

    const additionalUsers = Math.max(0, options?.additionalUsers ?? 1);
    const totalUserCount = await this.dbService.users.countDocuments({
      isDeleted: false,
    });

    this.logger.log(
      `[User Limit Check] context=${context}, totalUsers=${totalUserCount}, additional=${additionalUsers}, allowed=${allowedUserCount}`,
    );

    if (totalUserCount + additionalUsers > allowedUserCount) {
      const messageByContext: Record<typeof context, string> = {
        signup: 'Signup being temporarily unavailable kindly contact admin',
        'institution-managed':
          'The user limit has been exceeded. No additional users can be created.',
        'bulk-upload':
          'The user limit has been exceeded. Bulk upload is not allowed; no additional users can be uploaded.',
      };

      throw new BadRequestException({
        message: messageByContext[context],
        errorCode: context === 'signup' ? 'SIGNUP_RESTRICTED' : 'USER_LIMIT_EXCEEDED',
      });
    }
  }

  async getUsersByPhoneNumbers(
    phoneNumbers: string[],
    ownerId?: string,
  ): Promise<
    {
      phoneNumber: string;
      name?: string;
      userName?: string;
      userId?: string;
      connection?: any;
      request?: any;
    }[]
  > {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return [];
    }

    const lookupKeys = buildPhoneLookupKeys(phoneNumbers);
    if (lookupKeys.length === 0) {
      return [];
    }

    const matchStage: any = {
      isDeleted: false,
      status: USER_STATUS.ACTIVE,
      $expr: {
        $let: {
          vars: {
            digits: {
              $reduce: {
                input: {
                  $regexFindAll: { input: '$phoneNumber', regex: /\d+/ },
                },
                initialValue: '',
                in: { $concat: ['$$value', '$$this.match'] },
              },
            },
          },
          in: {
            $let: {
              vars: { len: { $strLenCP: '$$digits' } },
              in: {
                $or: PHONE_SUFFIX_LENGTHS.map((L) => ({
                  $and: [
                    { $gte: ['$$len', L] },
                    {
                      $in: [
                        {
                          $substrCP: [
                            '$$digits',
                            { $subtract: ['$$len', L] },
                            L,
                          ],
                        },
                        lookupKeys,
                      ],
                    },
                  ],
                })),
              },
            },
          },
        },
      },
    };

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $project: {
          _id: 0,
          userId: 1,
          phoneNumber: 1,
          name: 1,
          userName: 1,
          showPhoneNumber: 1,
        },
      },
    ];

    if (ownerId) {
      pipeline.push(
        // 1) Look for existing connection between owner and this user
        {
          $lookup: {
            from: 'connections',
            let: { peerUserId: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$ownerId', ownerId] },
                      { $eq: ['$peerId', '$$peerUserId'] },
                      { $eq: ['$isDeleted', false] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
            ],
            as: 'connection',
          },
        },
        // 2) If no connection, look for pending friend request from owner to this user
        {
          $lookup: {
            from: 'requests',
            let: {
              peerUserId: '$userId',
              hasConnectionCount: { $size: '$connection' },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      // Only when there is no connection
                      { $eq: ['$$hasConnectionCount', 0] },
                      { $eq: ['$actorId', ownerId] },
                      {
                        $or: [
                          { $eq: ['$targetId', '$$peerUserId'] },
                          {
                            // fallback: match via metadata.targetUserId when present
                            $eq: ['$metadata.targetUserId', '$$peerUserId'],
                          },
                        ],
                      },
                      { $eq: ['$targetType', 'user'] },
                      { $eq: ['$status', 'pending'] },
                      { $eq: ['$isDeleted', false] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
              {
                $project: {
                  _id: 0,
                  requestId: 1,
                  type: 1,
                  actorId: 1,
                  targetId: 1,
                  targetType: 1,
                  status: 1,
                  reqType: 1,
                  expiresAt: 1,
                  attempt: 1,
                  previousRequestId: 1,
                  idempotencyKey: 1,
                  blockedUntil: 1,
                  isDeleted: 1,
                  metadata: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
            ],
            as: 'request',
          },
        },
        {
          $addFields: {
            connection: { $arrayElemAt: ['$connection', 0] },
            request: { $arrayElemAt: ['$request', 0] },
          },
        },
      );
    }

    const usersWithConnections = await this.dbService.users.aggregate<any>(
      pipeline,
    );

    return usersWithConnections.map((u: any) => this.attachProfileImageUrl(u));
  }

  async findAllUsers(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean
  ): Promise<IPaginatedResult<IUsers[]>> {
    if (filter.isDeleted === undefined) {
      filter.isDeleted = { $in: [null, false] };
    }
    const result = await this.paginationService.findAndPaginate(this.dbService.users, { skip, limit, filter, nonPaginated });

    // Transform profileImage field to include CloudFront URL for each user
    if (result.items && Array.isArray(result.items)) {
      result.items = result.items.map((user: any) => this.attachProfileImageUrl(user));

      // Collect unique institution IDs from users with institution referral medium
      const institutionIds = new Set<string>();
      result.items.forEach((user: any) => {
        const isInstitutionReferral =
          user.referrerMedium === ReferrerMedium.INSTITUTION_MAIL ||
          user.referrerMedium === 'institutionMail';
        if (isInstitutionReferral && user.institutionsId && !user.referredBy) {
          institutionIds.add(user.institutionsId);
        }
      });

      // Batch fetch all institutions
      const institutionMap = new Map<string, any>();
      if (institutionIds.size > 0) {
        try {
          const institutionsResult = await this.recordService.findAll('institutions', {
            filters: {
              institutionsId: { $in: Array.from(institutionIds) }
            },
            nonPaginated: true,
          });

          if (institutionsResult?.items && Array.isArray(institutionsResult.items)) {
            institutionsResult.items.forEach((institution: any) => {
              const institutionObj = institution.toObject ? institution.toObject() : { ...institution };
              if (institutionObj.institutionsId) {
                institutionMap.set(institutionObj.institutionsId, institutionObj);
              }
            });
          }
        } catch (error) {
          console.error('Error batch fetching institution details:', error);
        }
      }

      // Map referredBy for users with institution referral medium
      result.items = result.items.map((user: any) => {
        const isInstitutionReferral =
          user.referrerMedium === ReferrerMedium.INSTITUTION_MAIL ||
          user.referrerMedium === 'institutionMail';
        if (
          isInstitutionReferral &&
          user.institutionsId &&
          !user.referredBy &&
          institutionMap.has(user.institutionsId)
        ) {
          const institution = institutionMap.get(user.institutionsId);
          if (institution?.institutionName) {
            user.referredBy = institution.institutionName;
          }
        }
        return user;
      });
    }

    return result;
  }

  async activateByQrCode(userId: string, referrerUserId: string) {
    // Check if the user exists
    const user = await this.dbService.users.findOne({
      userId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has already completed signup
    if (user.status === USER_STATUS.ACTIVE) {
      throw new BadRequestException('User signup is already completed. Cannot activate via QR code.');
    }

    const updateData: Record<string, any> = {
      status: USER_STATUS.ACTIVE,
      referrerMedium: ReferrerMedium.QR_CODE,
      qrAuth: true,
      updatedAt: new Date(),
    };
    if (referrerUserId) {
      const referrer = await this.dbService.users.findOne({
        userId: referrerUserId,
        isDeleted: false,
      });

      if (!referrer) {
        throw new NotFoundException('Referrer user not found');
      }

      // Prevent self-referral
      if (userId === referrerUserId) {
        throw new BadRequestException('Cannot refer yourself');
      }

      updateData.referrerId = referrerUserId;
      updateData.referredBy = referrer.userName ?? referrerUserId;
    }

    // Update user: activate, set referrer, and set activation medium
    // Only set isVerified to true if institutionId exists
    if (user.institutionsId) {
      updateData.isVerified = true;
    }

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { userId, isDeleted: false },
      updateData,
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('Failed to update user');
    }

    return {
      message: 'User activated successfully via QR code',
      user: this.attachProfileImageUrl(updatedUser),
    };
  }

  async activateByReferralCode(userId: string, referralCode?: string) {
    const user = await this.dbService.users.findOne({
      userId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === USER_STATUS.ACTIVE) {
      throw new BadRequestException('User signup is already completed.');
    }

    const updateData: Record<string, any> = {
      status: USER_STATUS.ACTIVE,
      referrerMedium: ReferrerMedium.REFERRAL_CODE,
      isReferralVerified: true,
      updatedAt: new Date(),
    };

    if (referralCode) {
      const referrer = await this.dbService.users.findOne({
        referralCode,
        isDeleted: false,
      });

      if (!referrer) {
        throw new NotFoundException('Invalid referral code');
      }

      if (user.userId === referrer.userId) {
        throw new BadRequestException('Cannot refer yourself');
      }

      updateData.referrerId = referrer.userId;
      updateData.referredBy = referrer.userName ?? referrer.userId;
    }

    // Only set isVerified to true if institutionId exists
    if (user.institutionsId) {
      updateData.isVerified = true;
    }

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { userId, isDeleted: false },
      updateData,
      { new: true },
    );

    if (!updatedUser) {
      throw new NotFoundException('Failed to update user');
    }

    return {
      message: 'User activated successfully via referral code',
      user: this.attachProfileImageUrl(updatedUser),
    };
  }

  private attachProfileImageUrl(user: any): any {
    if (!user) return user;

    const userObj = user.toObject ? user.toObject() : { ...user };

    if (userObj.profileImage) {
      userObj.profileImage = this.awsStoreService.getCloudFrontUrl(userObj.profileImage);
    }

    // Delete password if present to ensure it's not leaked in responses
    delete userObj.password;

    if (userObj.referrerMedium) {
      userObj.referredMedium = userObj.referrerMedium;
    }

    return userObj;
  }

  async getUserByUserId(userId: string) {
    const user = await this.dbService.users.findOne({
      userId: { $eq: userId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userWithImage = this.attachProfileImageUrl(user);

    // console.log("userWithImage:::::", userWithImage);

    // Populate institution details if institutionsId exists
    if (userWithImage.institutionsId) {
      try {
        const institution = await this.recordService.findOne('institutions', userWithImage.institutionsId);
        if (institution) {
          // Convert institution to plain object to ensure we can add fields
          const institutionObj = institution.toObject ? institution.toObject() : { ...institution };

          // Convert s3ProfileImageName to CloudFront URL if present
          if (institutionObj.s3ProfileImageName) {
            institutionObj.s3ProfileImageUrl = this.awsStoreService.getCloudFrontUrl(institutionObj.s3ProfileImageName);
          }

          userWithImage.institutionDetails = institutionObj;
        }
      } catch (error) {
        // If institution not found or error occurs, continue without institution details
        console.error('Error fetching institution details:', error);
      }
    }

    // Populate department details directly if the user has a departmentsId
    if (userWithImage.departmentsId) {
      try {
        const department = await this.recordService.findOne('departments', userWithImage.departmentsId);
        if (department) {
          userWithImage.departmentDetails = department;
        } else {
          userWithImage.departmentDetails = null
        }

      } catch (error) {
        console.error('Error fetching user department details:', error);
      }
    }
    // Alternatively, populate department details if user email matches admin user email
    // else if (userWithImage.email && userWithImage.institutionsId) {
    //   try {
    //     const adminUser = await this.dbService.adminUser.findOne({
    //       email: userWithImage.email.toLowerCase().trim(),
    //       isDeleted: { $ne: true }
    //     });

    //     if (adminUser && adminUser.metaTags && adminUser.metaTags.length > 0) {
    //       // Find the metaTag that matches the user's institutionsId
    //       const matchingMetaTag = adminUser.metaTags.find(
    //         (tag: any) => tag && tag.institutionsId && String(tag.institutionsId).trim() === String(userWithImage.institutionsId).trim()
    //       );

    //       if (matchingMetaTag && matchingMetaTag.departmentsId && Array.isArray(matchingMetaTag.departmentsId) && matchingMetaTag.departmentsId.length > 0) {
    //         // Fetch department details using departmentsId array
    //         const departmentsResult = await this.recordService.findAll('departments', {
    //           filters: {
    //             departmentsId: { $in: matchingMetaTag.departmentsId }
    //           },
    //           nonPaginated: true,
    //         });

    //         if (departmentsResult?.items && departmentsResult.items.length > 0) {
    //           userWithImage.departmentDetails = departmentsResult.items;
    //         }
    //       }
    //     }
    //   } catch (error) {
    //     console.error('Error fetching admin department details:', error);
    //   }
    // }

    // Populate referrer details if referrerId exists
    if (userWithImage.referrerId) {
      try {
        const referrer = await this.dbService.users.findOne({
          userId: { $eq: userWithImage.referrerId },
          isDeleted: false,
        });
        if (referrer) {
          userWithImage.referrerDetails = this.attachProfileImageUrl(referrer);
        }
      } catch (error) {
        console.error('Error fetching referrer details:', error);
      }
    }

    // For institution referral: ensure referredBy is institution name when we have it
    const isInstitutionReferral =
      userWithImage.referrerMedium === ReferrerMedium.INSTITUTION_MAIL ||
      userWithImage.referrerMedium === 'institutionMail';
    if (
      isInstitutionReferral &&
      userWithImage.institutionDetails?.institutionName &&
      !userWithImage.referredBy
    ) {
      userWithImage.referredBy =
        userWithImage.institutionDetails.institutionName;
    }

    return userWithImage;
  }

  async updateUserProfile(userId: string, dto: UpdateUserProfileDto) {
    const user = await this.dbService.users.findOne({
      userId: { $eq: userId },
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) {
      updatePayload.name = dto.name;
    }

    if (dto.userName !== undefined) {
      // Check if username is already taken by another user
      if (dto.userName) {
        const existingUser = await this.dbService.users.findOne({
          userName: dto.userName,
          isDeleted: false,
        });

        if (existingUser && existingUser.userId !== userId) {
          throw new BadRequestException('Username already taken');
        }
      }
      updatePayload.userName = dto.userName;
      updatePayload.userNameSet = true;
      updatePayload.isTemporaryUserName = false;
    }

    if (dto.s3FileName !== undefined) {
      updatePayload.profileImage = dto.s3FileName;
      updatePayload.profileImageUpdatedAt = new Date();
    }

    if (dto.showPhoneNumber !== undefined) {
      updatePayload.showPhoneNumber = dto.showPhoneNumber;
    }

    if (dto.muteNotifications !== undefined) {
      updatePayload.muteNotifications = dto.muteNotifications;
    }

    if (dto.disableReadReceipt !== undefined) {
      updatePayload.disableReadReceipt = dto.disableReadReceipt;
    }

    if (dto.status !== undefined) {
      updatePayload.status = dto.status;
    }

    const effectiveReferrerMedium = dto.referrerMedium;
    if (effectiveReferrerMedium !== undefined) {
      updatePayload.referrerMedium = effectiveReferrerMedium;
    }

    if (dto.departmentsId !== undefined) {
      updatePayload.departmentsId = dto.departmentsId;
    }

    // When referrerMedium is set to institution referral and user has referrerId, set referredBy to institution name
    if (
      dto.referrerMedium === ReferrerMedium.INSTITUTION_MAIL &&
      user.referrerId &&
      dto.referrerId !== null &&
      dto.referrerId !== ''
    ) {
      try {
        const referrer = await this.dbService.users.findOne({
          userId: { $eq: user.referrerId },
          isDeleted: false,
        });
        if (referrer?.institutionsId) {
          const institution = await this.recordService.findOne(
            'institutions',
            referrer.institutionsId,
          );
          const institutionObj = institution?.toObject
            ? institution.toObject()
            : institution;
          updatePayload.referredBy =
            institutionObj?.institutionName ??
            referrer.userName ??
            user.referrerId;
        }
      } catch {
        // Keep existing referredBy on error
      }
    }

    if (dto.referrerId !== undefined) {
      if (dto.referrerId) {
        const referrer = await this.dbService.users.findOne({
          userId: dto.referrerId,
          isDeleted: false,
        });
        if (!referrer) {
          throw new BadRequestException('Referrer user not found');
        }
        if (dto.referrerId === userId) {
          throw new BadRequestException('Cannot set yourself as referrer');
        }
        updatePayload.referrerId = dto.referrerId;

        const effectiveReferrerMedium =
          dto.referrerMedium ?? user.referrerMedium;
        const isInstitutionReferral =
          effectiveReferrerMedium === ReferrerMedium.INSTITUTION_MAIL;

        if (isInstitutionReferral && referrer.institutionsId) {
          try {
            const institution = await this.recordService.findOne(
              'institutions',
              referrer.institutionsId,
            );
            const institutionObj = institution?.toObject
              ? institution.toObject()
              : institution;
            updatePayload.referredBy =
              institutionObj?.institutionName ??
              referrer.userName ??
              dto.referrerId;
          } catch {
            updatePayload.referredBy =
              referrer.userName ?? dto.referrerId;
          }
        } else {
          updatePayload.referredBy = referrer.userName ?? dto.referrerId;
        }
      } else {
        updatePayload.referrerId = null;
        updatePayload.referredBy = null;
      }
    }

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { userId, isDeleted: false },
      updatePayload,
      { new: true },
    );

    return {
      message: 'Profile updated successfully',
      user: this.attachProfileImageUrl(updatedUser),
    };
  }

  /**
   * Find users that are not yet friends (no pending/accepted friend request with requester).
   * Single O(n) approach: one agg on requests for excluded user IDs, then one users query with $nin.
   * Indexes are ensured on first use (see ensureFindFriendsIndexes).
   */
  async findFriends(
    requesterId: string,
    skip: number = 0,
    limit: number = 10,
    nonPaginated: boolean = false,
    search?: string,
  ): Promise<IPaginatedResult<IUsers[]>> {
    // 1) Single aggregation on requests: get all peer user IDs that have pending/accepted friend request with requester
    const excludedPeerIds = await this.getExcludedFriendPeerIds(requesterId);

    // 2) Build users filter: not requester, not in excluded list, active, optional search
    const excludeUserIds = [...excludedPeerIds, requesterId];
    const userFilter: Record<string, any> = {
      userId: { $nin: excludeUserIds },
      isDeleted: false,
      status: USER_STATUS.ACTIVE,
    };
    if (search) {
      userFilter.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    if (!nonPaginated) {
      const validatedSkip = skip >= 0 ? skip : 0;
      const validatedLimit = limit > 0 ? limit : 10;

      // 3) Single pass: count and find in parallel (both use same index)
      const [totalItems, items] = await Promise.all([
        this.dbService.users.countDocuments(userFilter),
        this.dbService.users.find(userFilter, undefined, {
          sort: { createdAt: -1 },
          skip: validatedSkip,
          limit: validatedLimit,
        }),
      ]);
      const totalPages = Math.max(Math.ceil(totalItems / validatedLimit), 1);
      return {
        totalItems,
        totalPages,
        skip: validatedSkip,
        limit: validatedLimit,
        items: (items || []).map((user: any) => this.maskPhoneIfHidden(this.attachProfileImageUrl(user))),
      } as IPaginatedResult<IUsers[]>;
    }

    const items = await this.dbService.users.find(userFilter, undefined, {
      sort: { createdAt: -1 },
    });
    return {
      totalItems: (items || []).length,
      totalPages: 1,
      skip: 0,
      limit: (items || []).length,
      items: (items || []).map((user: any) => this.maskPhoneIfHidden(this.attachProfileImageUrl(user))),
    } as IPaginatedResult<IUsers[]>;
  }

  /**
   * Returns a copy of the user object without phoneNumber when showPhoneNumber is false.
   */
  private maskPhoneIfHidden(user: any): any {
    if (!user) return user;
    if (user.showPhoneNumber === false) {
      const { phoneNumber: _, ...rest } = user;
      return rest;
    }
    return user;
  }

  /**
   * Find all users (excluding requester) and append friend connection / request details
   * between the requester and each user.
   * This reads directly from the users collection and then batch-loads connection + request docs.
   */
  async findAllFriends(
    requesterId: string,
    skip: number = 0,
    limit: number = 10,
    nonPaginated: boolean = false,
    search?: string,
  ): Promise<IPaginatedResult<IUsers[]>> {
    const userFilter: Record<string, any> = {
      userId: { $ne: requesterId },
      isDeleted: false,
      status: USER_STATUS.ACTIVE,
    };

    if (search) {
      userFilter.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    let items: any[] = [];
    let totalItems = 0;
    let validatedSkip = 0;
    let validatedLimit = 0;

    if (!nonPaginated) {
      validatedSkip = skip >= 0 ? skip : 0;
      validatedLimit = limit > 0 ? limit : 10;

      const [count, users] = await Promise.all([
        this.dbService.users.countDocuments(userFilter),
        this.dbService.users.find(userFilter, undefined, {
          sort: { createdAt: -1 },
          skip: validatedSkip,
          limit: validatedLimit,
        }),
      ]);

      totalItems = count;
      items = users || [];
    } else {
      items =
        (await this.dbService.users.find(userFilter, undefined, {
          sort: { createdAt: -1 },
        })) || [];
      totalItems = items.length;
      validatedSkip = 0;
      validatedLimit = items.length;
    }

    // Batch-load connection and friend-request details for all returned users
    const peerIds = items
      .map((u: any) => u.userId)
      .filter((id: any) => typeof id === 'string');

    let connectionsByPeerId: Record<string, any> = {};
    let requestsByPeerId: Record<string, any> = {};

    if (peerIds.length > 0) {
      const db = this.connection.db;

      const [connections, requests] = await Promise.all([
        db
          .collection('connections')
          .find({
            ownerId: requesterId,
            peerId: { $in: peerIds },
          })
          .toArray(),
        db
          .collection('requests')
          .find({
            type: 'friend',
            reqType: 'friendRequest',
            actorId: requesterId,
            targetId: { $in: peerIds },
          })
          .toArray(),
      ]);

      connectionsByPeerId = (connections || []).reduce(
        (acc: Record<string, any>, conn: any) => {
          if (!conn) return acc;
          // Determine the "other" user in the connection relative to requesterId
          const peerIdForMap =
            conn.peerId === requesterId ? conn.ownerId : conn.peerId;
          if (peerIdForMap) {
            acc[peerIdForMap] = conn;
          }
          return acc;
        },
        {},
      );

      requestsByPeerId = (requests || []).reduce(
        (acc: Record<string, any>, req: any) => {
          let peerId: string | undefined;
          if (req.actorId === requesterId) {
            peerId = req.targetId ?? req.metadata?.targetUserId;
          } else if (req.targetId === requesterId) {
            peerId = req.actorId;
          }

          if (peerId) {
            acc[peerId] = req;
          }
          return acc;
        },
        {},
      );
    }

    const itemsWithDetails = (items || []).map((user: any) => {
      const userId = user.userId;
      const connection = connectionsByPeerId[userId];
      const request = requestsByPeerId[userId];

      // First attach profile image URL, then append connection/request
      const userWithImage = this.attachProfileImageUrl(user);
      const out: any = {
        ...userWithImage,
        connection,
        request,
      };
      return out;
    });

    const totalPages = Math.max(
      Math.ceil(totalItems / (validatedLimit || 1)),
      1,
    );

    return {
      totalItems,
      totalPages,
      skip: validatedSkip,
      limit: validatedLimit,
      items: itemsWithDetails,
    } as IPaginatedResult<IUsers[]>;
  }

  /**
   * One aggregation on requests: returns list of user IDs that already have
   * pending/accepted friend request with requesterId (so we exclude them from find-friends).
   */
  private async getExcludedFriendPeerIds(requesterId: string): Promise<string[]> {
    const requestsColl = this.connection.db.collection('requests');
    const result = await requestsColl
      .aggregate<{ _id: null; peerIds: string[] }>([
        {
          $match: {
            type: 'friend',
            reqType: 'friendRequest',
            status: { $in: ['pending', 'accepted'] },
            isDeleted: { $ne: true },
            $or: [
              { actorId: requesterId },
              { targetId: requesterId },
              { 'metadata.targetUserId': requesterId },
            ],
          },
        },
        {
          $project: {
            peerId: {
              $cond: {
                if: { $eq: ['$actorId', requesterId] },
                then: { $ifNull: ['$targetId', '$metadata.targetUserId'] },
                else: '$actorId',
              },
            },
          },
        },
        { $group: { _id: null, peerIds: { $addToSet: '$peerId' } } },
      ])
      .toArray();
    const peerIds = result[0]?.peerIds ?? [];
    return peerIds.filter((id): id is string => id != null && id !== requesterId);
  }

  private async safeCreateIndex(
    collectionName: string,
    indexSpec: Record<string, any>,
    options?: Record<string, any>,
  ): Promise<void> {
    const db = this.connection.db;
    try {
      await db.collection(collectionName).createIndex(indexSpec, options);
    } catch (error: any) {
      // Ignore index conflicts when index already exists with different name/options
      if (error?.code === 85 || error?.codeName === 'IndexOptionsConflict') {
        return;
      }
      throw error;
    }
  }

  /**
   * Ensures indexes used by findFriends exist (idempotent). Call once at app bootstrap.
   */
  async ensureFindFriendsIndexes(): Promise<void> {
    await Promise.all([
      // General users collection indexes for fast lookups
      this.safeCreateIndex('users', { phoneNumber: 1, isDeleted: 1 }, { name: 'users_phoneNumber_isDeleted' }),
      this.safeCreateIndex('users', { userId: 1, isDeleted: 1 }, { name: 'users_userId_isDeleted' }),
      this.safeCreateIndex('users', { email: 1, isDeleted: 1, status: 1 }, { name: 'users_email_isDeleted_status' }),
      this.safeCreateIndex('users', { userName: 1, isDeleted: 1 }, { name: 'users_userName_isDeleted' }),
      // Existing find-friends specific index
      this.safeCreateIndex(
        'users',
        { status: 1, isDeleted: 1, createdAt: -1 },
        { name: 'findFriends_users_status_isDeleted_createdAt' },
      ),
      // Connections collection indexes for friend lookups
      this.safeCreateIndex(
        'connections',
        { ownerId: 1, peerId: 1, isDeleted: 1 },
        { name: 'connections_owner_peer_isDeleted' },
      ),
      // Requests collection indexes for friend requests
      this.safeCreateIndex(
        'requests',
        {
          type: 1,
          reqType: 1,
          status: 1,
          actorId: 1,
          targetId: 1,
          'metadata.targetUserId': 1,
        },
        { name: 'findFriends_requests_type_reqType_status_actor_target_meta' },
      ),
    ]);
  }

  /** Mongo update that strips institution linkage and institutional email from a user profile. */
  private buildInstitutionDetachUpdate() {
    return {
      $set: { isVerified: false, emailVerified: false, updatedAt: new Date() },
      $unset: {
        institutionsId: 1,
        departmentsId: 1,
        email: 1,
        emailOtp: 1,
        emailOtpExpiry: 1,
        metaData: 1,
      },
    };
  }

  /** Removes institutional email attributes from Cognito when present on the user record. */
  private async clearInstitutionalEmailFromCognito(phoneNumber?: string): Promise<void> {
    if (!phoneNumber) {
      return;
    }

    try {
      await this.cognitoClient.send(
        new AdminDeleteUserAttributesCommand({
          UserPoolId: this.userPoolId,
          Username: phoneNumber,
          UserAttributeNames: ['email', 'email_verified'],
        }),
      );
    } catch (error) {
      console.error('Failed to clear institutional email from Cognito:', error);
    }
  }

  /**
   * Removes a user from their institution (Global Users list) without deleting the account.
   * Clears institution-specific data (institution access, institutional email and its
   * verification state, and any institution metadata) so the profile only retains valid
   * global user details. Also removes the user from institution-scoped chat groups when possible.
   */
  async removeUserFromInstitution(userId: string) {
    const user = await this.dbService.users.findOne({ userId, isDeleted: false });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.institutionsId) {
      throw new BadRequestException('User is not associated with any institution');
    }

    const institutionsId = user.institutionsId;
    const hadInstitutionalEmail = Boolean(user.email?.trim());

    const updated = await this.dbService.users.findOneAndUpdate(
      { userId, isDeleted: false },
      this.buildInstitutionDetachUpdate(),
      { new: true },
    );

    if (hadInstitutionalEmail) {
      await this.clearInstitutionalEmailFromCognito(user.phoneNumber);
    }

    try {
      await this.httpClientService.delete(
        'NAACHI_CHAT_SERVICE',
        `/group-member/user/${userId}`,
        { institutionsId },
      );
    } catch (chatErr) {
      console.error('Failed to remove user from institution groups:', chatErr);
    }

    return {
      message: 'User removed from institution',
      user: this.attachProfileImageUrl(updated),
    };
  }

  async bulkRemoveUsersFromInstitution(userIds: string[]) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestException('No user IDs provided for removal');
    }

    const results: any[] = [];
    const skipped: Array<{ userId: string; reason: string }> = [];

    for (const userId of userIds) {
      const user = await this.dbService.users.findOne({ userId, isDeleted: false });
      if (!user) {
        skipped.push({ userId, reason: 'User not found' });
        continue;
      }
      if (!user.institutionsId) {
        skipped.push({ userId, reason: 'User is not associated with any institution' });
        continue;
      }

      const institutionsId = user.institutionsId;
      const hadInstitutionalEmail = Boolean(user.email?.trim());

      const updated = await this.dbService.users.findOneAndUpdate(
        { userId, isDeleted: false },
        this.buildInstitutionDetachUpdate(),
        { new: true },
      );

      if (hadInstitutionalEmail) {
        await this.clearInstitutionalEmailFromCognito(user.phoneNumber);
      }

      try {
        await this.httpClientService.delete(
          'NAACHI_CHAT_SERVICE',
          `/group-member/user/${userId}`,
          { institutionsId },
        );
      } catch (chatErr) {
        console.error(`Failed to remove user ${userId} from institution groups:`, chatErr);
      }

      results.push(this.attachProfileImageUrl(updated));
    }

    return {
      message: `${results.length} user(s) removed from institution`,
      removedCount: results.length,
      users: results,
      skipped,
    };
  }

  async deleteUser(userId: string, isDeleted: boolean )
  {
    const user = await this.dbService.users.findOne({userId: { $eq: userId },isDeleted: false})

    if(!user)
    {
      throw new NotFoundException('User Not Found');
    }

    const { nanoid } = await import('nanoid')
    const randomId = nanoid(8);


    const updatePayload = {
      isDeleted: true,
      status: USER_STATUS.INACTIVE,
      name: "naachi_user",
      userName: `deleted_user_${randomId}`,
      profileImage: "",
    };

    const updatedUser = await this.dbService.users.findOneAndUpdate(
      { userId, isDeleted: false },
      { $set: updatePayload },
      { new: true },
    );

    if (user.phoneNumber) {
      try {
        await this.cognitoClient.send(
          new AdminDeleteUserCommand({
            UserPoolId: this.userPoolId,
            Username: user.phoneNumber,
          })
        );
      } catch (cognitoErr) {
        // Keep database update intact if user already not found in Cognito
      }
    }

      try {
        await this.httpClientService.delete('NAACHI_CHAT_SERVICE', `/group-member?userId=${userId}`);
      } catch (chatErr: any) {
        console.error(`Failed to clean up chat group membership for user ${userId}:`, chatErr.message || chatErr);
      }

    return {
      message: 'User deleted successfully',
      user: updatedUser,
    }

  };

  async bulkDeleteUsers(userIds: string[]) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestException('No user IDs provided for deletion');
    }

    const { nanoid } = await import('nanoid');
    const results = [];

    for (const userId of userIds) {
      const user = await this.dbService.users.findOne({ userId: { $eq: userId }, isDeleted: false });
      if (user) {
        const randomId = nanoid(8);
        const updatePayload = {
          isDeleted: true,
          status: USER_STATUS.INACTIVE,
          name: "naachi_user",
          userName: `deleted_user_${randomId}`,
          profileImage: "",
        };

        const updatedUser = await this.dbService.users.findOneAndUpdate(
          { userId: { $eq: userId }, isDeleted: false },
          { $set: updatePayload },
          { new: true }
        );

        if (user.phoneNumber) {
          try {
            await this.cognitoClient.send(
              new AdminDeleteUserCommand({
                UserPoolId: this.userPoolId,
                Username: user.phoneNumber,
              })
            );
          } catch (cognitoErr) {
            // Ignore if user is absent from Cognito
          }
        }

        try {
          await this.httpClientService.delete('NAACHI_CHAT_SERVICE', `/group-member?userId=${userId}`);
        } catch (chatErr: any) {
          console.error(`Failed to clean up chat group membership for user ${userId}:`, chatErr.message || chatErr);
        }

        results.push(updatedUser);
      }
    }

    return {
      message: `${results.length} users deleted successfully`,
      deletedCount: results.length,
    };
  }
}





