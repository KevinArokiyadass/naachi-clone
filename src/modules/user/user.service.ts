import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
import { UpdateUserDto } from './dto/update-profile.dto';
import { UserDocument } from './entity/user.entity';
import { UserType, IUser } from 'src/common/interfaces/user.interface';
import { CreateUserDto, CreateMemberDto, CreateAdminDto } from './dto/signup.dto';
import { EmailService } from 'src/common/services/email.service';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import { generateRandomPassword, hashPassword } from 'src/common/utils/util';
import { AnalyticsFilterDto, AnalyticsFilterResponseDto, AnalyticsGraphResponseDto, DateFilterDto } from './dto/analytics-filter.dto';
import { RecordService } from '@noukha-technologies/mdm-core';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class UserService {

  private readonly opalSuperAdminEmail = 'ranjeeth@opalgcc.com'
  private readonly SUPER_ADMIN_DEFAULT_OTP = '1234'

  constructor(
    private dbService: IMongoDBServices,
    private emailService: EmailService,
    private httpClient: HttpClientService,
    private recordService: RecordService,
    private paginationService: PaginationService,
    private notificationService: NotificationService
  ) { }

  async getLocationById(locationId: string): Promise<string> {
    const location = await this.recordService.findOne('location', locationId);
    return location.locationName;
  }

  async getDivisionById(divisionId: string): Promise<string> {
    const division = await this.recordService.findOne('division', divisionId);
    return division.divisionName;
  }

  async updateUserFcmToken(userId: string, fcmTokenData: { type: string; token: string }): Promise<{ message: string }> {
    const user = await this.dbService.user.findOne({ userId }) as UserDocument | null;

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get existing fcmTokens or initialize empty array
    const existingTokens = user.fcmTokens || [];

    // Remove existing token of the same type
    const filteredTokens = existingTokens.filter(t => t.type !== fcmTokenData.type);

    // Add new token
    const updatedTokens = [...filteredTokens, fcmTokenData];

    const updatedUser = await this.dbService.user.findOneAndUpdate(
      { userId },
      { fcmTokens: updatedTokens },
      { new: true },
    ) as UserDocument | null;

    return { message: 'FCM token updated successfully' };
  }

  async getLocationsAndDivisions(): Promise<{
    locations: Array<{ locationId: string; locationName: string }>;
    divisions: Array<{ divisionId: string; divisionName: string }>
  }> {

    const locationRes = await this.recordService.findAll('location', {
      nonPaginated: true,
      sort: 'location',
      order: 'asc',
      filters: { isDeleted: false },
    });
    const divisionRes = await this.recordService.findAll('division', {
      nonPaginated: true,
      sort: 'division',
      order: 'asc',
      filters: { isDeleted: false },
    });
    const locations = locationRes?.items ?? [];
    const divisions = divisionRes?.items ?? [];
    return {
      locations: locations.map((location: any) => ({
        locationId: location.locationId || location._id,
        locationName: location.locationName
      })),
      divisions: divisions.map((division: any) => ({
        divisionId: division.divisionId || division._id,
        divisionName: division.divisionName
      })),
    };
  }

  /**
   * Populate location and division names for a user object
   */
  async populateUserMasterData(user: any): Promise<any> {
    try {
      // Fetch location name if locationId exists
      if (user.locationId) {
        const location = await this.recordService.findOne('location', user.locationId);
        user.locationDetails = {
          locationName: location?.locationName || null
        };
      }

      // Fetch division name if divisionId exists
      if (user.divisionId) {
        const division = await this.recordService.findOne('division', user.divisionId);
        user.divisionDetails = {
          divisionName: division?.divisionName || null
        };
      }

      return user;
    } catch (error) {
      // If master data fetch fails, continue without names
      console.warn('Failed to fetch master data for user:', error.message);
      return user;
    }
  }

  /**
   * Populate location and division names for multiple users
   */
  private async populateUsersMasterData(users: any[]): Promise<any[]> {
    const populatedUsers = await Promise.all(
      users.map(user => this.populateUserMasterData(user))
    );
    return populatedUsers;
  }


  async getFilteredAnalytics(dto: AnalyticsFilterDto): Promise<AnalyticsFilterResponseDto> {
    const { divisionId, locationId } = dto;
    const query: any = { isActive: true };
    if (divisionId) query.divisionId = divisionId;
    if (locationId) query.locationId = locationId;
    const analyticsFilterResponse = new AnalyticsFilterResponseDto();
    const analytics = await this.dbService.user.find(query);
    const userIds: string[] = analytics.map((user: UserDocument) => user.userId);

    if (userIds.length > 0) {
      analyticsFilterResponse.totalUsers = userIds.length;
      try {
        const ticketAnalytics = await this.httpClient.post<any>(
          'OPAL_CHAT_SERVICE',
          '/ticket/analytics',
          { userIds }
        );
        // Normalize to an array of tickets
        const rawTickets = (ticketAnalytics as any)?.data ?? (ticketAnalytics as any)?.result?.data ?? ticketAnalytics;
        const tickets: Array<{ createdAt: string; status: string }> = Array.isArray(rawTickets) ? rawTickets : [];

        // Optional date filtering
        let filteredTickets = tickets;
        const date = dto.date;
        if (date?.startDate && date?.endDate) {
          const start = new Date(date.startDate).getTime();
          const end = new Date(date.endDate).getTime();
          filteredTickets = tickets.filter((t) => {
            const ts = new Date(t.createdAt).getTime();
            return ts >= start && ts <= end;
          });
        }

        // Count totals and aggregate by conversationCategoryId
        const graph = new AnalyticsGraphResponseDto();
        graph.totalCount = 0;
        graph.createdAt = [];
        let openCount = 0;
        let inprogressCount = 0;
        let closedCount = 0;
        const categoryCount: Record<string, number> = {};
        for (const ticket of filteredTickets as Array<any>) {
          const status = String(ticket.status || '').toLowerCase();

          // Only count non-pending tickets in status counts and category counts
          if (status !== 'pending') {
            graph.createdAt.push(new Date(ticket.createdAt));
            const categoryId: string | undefined = ticket.conversationCategoryId;
            if (categoryId) {
              categoryCount[categoryId] = (categoryCount[categoryId] ?? 0) + 1;
            }

            if (status === 'open') openCount++;
            else if (status === 'in_progress') inprogressCount++;
            else if (status === 'closed') closedCount++;
          }
        }
        // Total tickets excluding pending status
        analyticsFilterResponse.totalNumberOfTickets = openCount + inprogressCount + closedCount;
        analyticsFilterResponse.totalNumberOfOpenTickets = openCount;
        analyticsFilterResponse.totalNumberOfInProgressTickets = inprogressCount;
        analyticsFilterResponse.totalNumberOfClosedTickets = closedCount;
        graph.totalCount = openCount + inprogressCount + closedCount;
        analyticsFilterResponse.analyticsGraph = graph;


        // Build categorySummary by mapping IDs to names from MDM
        try {
          const conversationCategoryRes = await this.recordService.findAll('conversationcategory', {
            nonPaginated: true,
            sort: 'conversationcategory',
            order: 'asc',
          });
          const items: any[] = conversationCategoryRes?.items?.map(item => item.toObject()) ?? [];
          const idToName = new Map<string, string>();
          for (const c of items) {
            const id = (c as any).conversationCategoryId ?? (c as any).conversationcategoryid ?? (c as any)._id;
            const name = (c as any).conversationCategoryName ?? (c as any).conversationcategory ?? (c as any).name ?? id;
            if (id) idToName.set(id, name ?? id);
          }
          analyticsFilterResponse.categorySummary = Object.entries(categoryCount).map(([id, count]) => ({
            name: idToName.get(id) ?? id,
            ticketCount: count as number,
          }));
        } catch {
          analyticsFilterResponse.categorySummary = Object.entries(categoryCount).map(([id, count]) => ({
            name: id,
            ticketCount: count as number,
          }));
        }
      } catch (error) {
        console.error('Error fetching ticket analytics:', error);
        throw new Error('Error fetching ticket analytics');
      }
    } else {
      analyticsFilterResponse.totalUsers = 0;
      analyticsFilterResponse.totalNumberOfTickets = 0;
      analyticsFilterResponse.totalNumberOfOpenTickets = 0;
      analyticsFilterResponse.totalNumberOfInProgressTickets = 0;
      analyticsFilterResponse.totalNumberOfClosedTickets = 0;
      analyticsFilterResponse.categorySummary = [];
      analyticsFilterResponse.analyticsGraph = { createdAt: [], totalCount: 0 };
      return analyticsFilterResponse;
    }

    // const hasDateRange = !!(dto?.date?.startDate && dto?.date?.endDate);
    // analyticsFilterResponse.analyticsGraph = await this.getAnalyticsGraph(hasDateRange ? dto : undefined);

    return analyticsFilterResponse;
  }



  async createUser(dto: CreateUserDto): Promise<{ message: string; userId: string; tempPassword?: string }> {
    const { emailId, employeeId, phoneNumber, firstName, lastName, address, divisionId, locationId, userType, permissionGroup, password, profileImageUrl } = dto;

    // Validation for user type specific requirements
    if (userType === UserType.ADMIN && !emailId) {
      throw new BadRequestException('Email is required for admin users');
    }

    if (userType === UserType.MEMBER && !phoneNumber) {
      throw new BadRequestException('Phone number is required for member users');
    }

    // Check if user already exists
    const existingConditions: any[] = [];
    if (emailId) existingConditions.push({ emailId });
    if (employeeId) existingConditions.push({ employeeId });
    if (phoneNumber) existingConditions.push({ phoneNumber });

    if (existingConditions.length > 0) {
      const existingUser = await this.dbService.user.findOne({
        $or: existingConditions
      }) as UserDocument | null;

      if (existingUser) {
        throw new BadRequestException('User with this email, employee ID, or phone number already exists');
      }
    }

    let hashedPassword: string | undefined;
    let tempPassword: string | undefined;

    // Handle password based on user type
    if (userType === UserType.ADMIN) {
      if (password) {
        hashedPassword = await hashPassword(password);
      } else {
        // Generate random password for admin if not provided
        tempPassword = generateRandomPassword(12);
        hashedPassword = await hashPassword(tempPassword);
      }
    } else if (userType === UserType.MEMBER) {
      // Members don't need password (they use OTP)
      hashedPassword = undefined;
    }

    // Create new user in database
    const newUser = await this.dbService.user.create({
      emailId,
      employeeId,
      phoneNumber,
      firstName,
      lastName,
      address,
      divisionId,
      locationId,
      userType,
      password: hashedPassword,
      permissionGroup: permissionGroup || [],
      profileImageUrl,
      isActive: true,
    }) as UserDocument;

    // Send welcome email for admin users
    if (userType === UserType.ADMIN && emailId && tempPassword) {
      try {
        await this.emailService.sendWelcomeEmail(emailId, firstName, tempPassword);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't throw error here, user is created successfully
      }
    }

    const response: { message: string; userId: string; tempPassword?: string } = {
      message: userType === UserType.ADMIN
        ? 'Admin user created successfully. Welcome email sent with login credentials.'
        : 'Member user created successfully. They can login using phone number and OTP.',
      userId: newUser.userId,
    };

    if (tempPassword) {
      response.tempPassword = tempPassword;
    }

    return response;
  }

  // Create Admin User specifically
  async createAdminUser(dto: CreateAdminDto): Promise<{ message: string; userId: string }> {
    const { emailId, employeeId, phoneNumber, firstName, lastName, address, divisionId, locationId, permissionGroup, password, profileImageUrl } = dto;

    // Check if user already exists
    const existingConditions: any[] = [];
    if (emailId) existingConditions.push({ emailId });
    if (employeeId) existingConditions.push({ employeeId });
    if (phoneNumber) existingConditions.push({ phoneNumber });

    if (existingConditions.length > 0) {
      const existingUser = await this.dbService.user.findOne({
        $or: existingConditions
      }) as UserDocument | null;

      if (existingUser) {
        throw new BadRequestException('User with this email, employee ID, or phone number already exists');
      }
    }

    // Create new admin user in database
    const newUser = await this.dbService.user.create({
      emailId,
      employeeId,
      phoneNumber,
      firstName,
      lastName,
      address,
      divisionId,
      locationId,
      userType: UserType.ADMIN,
      password: password,
      permissionGroup: permissionGroup || [],
      profileImageUrl,
      isActive: true,
    }) as UserDocument;

    return {
      message: 'Admin user created successfully.',
      userId: newUser.userId,
    };
  }

  async createMembersFromExcel(fileBuffer: Buffer): Promise<{ successCount: number; failureCount: number; results: Array<{ index: number; status: 'success' | 'error'; userId?: string; error?: string }> }> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'members') || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const { locations, divisions } = await this.getLocationsAndDivisions();
    const locationNameToId = new Map(locations.map(l => [String(l.locationName).toLowerCase().trim(), l.locationId]));
    const divisionNameToId = new Map(divisions.map(d => [String(d.divisionName).toLowerCase().trim(), d.divisionId]));

    const results: Array<{ index: number; status: 'success' | 'error'; userId?: string; error?: string }> = [];
    let successCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const phoneNumber = String(r.phoneNumber || r.phone || r.phonenum || r.phoneNum || '').trim();
        const firstName = String(r.firstName || r.firstname || r.first_name || '').trim();
        const lastName = String(r.lastName || r.lastname || r.last_name || '').trim() || undefined;
        const emailId = String(r.emailId || r.email || '').trim() || undefined;
        const address = String(r.address || '').trim() || undefined;
        const employeeId = String(r.employeeId || r.employeeID || r.employee || r.empId || r.empid || '').trim() || undefined;
        const divisionRaw = String(r.divisionId || r.division || '').trim();
        const locationRaw = String(r.locationId || r.location || '').trim();

        const divisionId = divisionRaw && divisionNameToId.get(divisionRaw.toLowerCase()) ? divisionNameToId.get(divisionRaw.toLowerCase()) : (divisionRaw || undefined);
        const locationId = locationRaw && locationNameToId.get(locationRaw.toLowerCase()) ? locationNameToId.get(locationRaw.toLowerCase()) : (locationRaw || undefined);

        if (!phoneNumber || !firstName) {
          throw new Error('phoneNumber and firstName are required');
        }

        const dto: CreateMemberDto = {
          phoneNumber,
          firstName,
          lastName,
          emailId,
          address,
          employeeId,
          divisionId,
          locationId,
        } as any;

        const res = await this.createMemberUser(dto);
        results.push({ index: i, status: 'success', userId: res.userId });
        successCount++;
      } catch (err: any) {
        results.push({ index: i, status: 'error', error: err?.message || 'Unknown error' });
      }
    }
    return { successCount, failureCount: results.length - successCount, results };
  }

  // Create Member User specifically
  async createMemberUser(dto: CreateMemberDto): Promise<{ message: string; userId: string }> {
    const { phoneNumber, firstName, lastName, address, divisionId, locationId, emailId, permissionGroup, profileImageUrl, employeeId } = dto;

    // Check if user already exists
    const existingConditions: any[] = [{ phoneNumber }];
    if (emailId) existingConditions.push({ emailId });
    if (employeeId) existingConditions.push({ employeeId });

    const existingUser = await this.dbService.user.findOne({
      $or: existingConditions
    }) as UserDocument | null;

    if (existingUser) {
      throw new BadRequestException('User with this phone number or email already exists');
    }

    // Create new member user in database (no password needed)
    const newUser = await this.dbService.user.create({
      phoneNumber,
      emailId,
      employeeId,
      firstName,
      lastName,
      address,
      divisionId,
      locationId,
      userType: UserType.MEMBER,
      password: undefined, // Members don't have passwords
      permissionGroup: permissionGroup || [],
      profileImageUrl,
      isActive: true,
    }) as UserDocument;

    return {
      message: 'Member user created successfully. They can login using phone number and OTP.',
      userId: newUser.userId,
    };
  }


  async getAllUsers(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean = false,
  ): Promise<IPaginatedResult<IUser[]>> {
    filter.isDeleted = { $in: [null, false] };
    const userDetails = await this.paginationService.findAndPaginate(
      this.dbService.user,
      {
        skip,
        limit,
        filter,
        nonPaginated,
        sort: { firstName: 1 }
      },
    );

    // Populate location and division names for all users
    const enrichedUsers = await this.populateUsersMasterData(userDetails.items || []);

    return {
      ...userDetails,
      items: enrichedUsers
    };
  }


  async updateUser(userId: string, updateData: UpdateUserDto): Promise<{ message: string; user: UserDocument }> {
    // Check if email is being updated and if it already exists
    if (updateData.emailId) {
      const existingUser = await this.dbService.user.findOne({
        emailId: updateData.emailId,
        userId: { $ne: userId } // Exclude current user
      }) as UserDocument | null;

      if (existingUser) {
        throw new BadRequestException('Email is already in use by another user');
      }
    }

    // Check if employee ID is being updated and if it already exists
    if (updateData.employeeId) {
      const existingUser = await this.dbService.user.findOne({
        employeeId: updateData.employeeId,
        userId: { $ne: userId } // Exclude current user
      }) as UserDocument | null;

      if (existingUser) {
        throw new BadRequestException('Employee ID is already in use by another user');
      }
    }

    // Check if phone number is being updated and if it already exists
    if (updateData.phoneNumber) {
      const existingUser = await this.dbService.user.findOne({
        phoneNumber: updateData.phoneNumber,
        userId: { $ne: userId } // Exclude current user
      }) as UserDocument | null;

      if (existingUser) {
        throw new BadRequestException('Phone number is already in use by another user');
      }
    }

    const updatedUser = await this.dbService.user.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true },
    ) as UserDocument | null;

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    // Populate master data for the updated user
    const populatedUser = await this.populateUserMasterData(updatedUser);

    return {
      message: 'User updated successfully',
      user: populatedUser,
    };
  }

  async getUser(userId: string): Promise<UserDocument | null> {
    const user = await this.dbService.user.findOne({ userId }) as UserDocument | null;
    if (user) {
      return await this.populateUserMasterData(user);
    }
    return user;
  }

  async getUserByEmail(emailId: string): Promise<UserDocument | null> {
    const user = await this.dbService.user.findOne({ emailId }) as UserDocument | null;
    if (user) {
      return await this.populateUserMasterData(user);
    }
    return user;
  }

  async removeFcmTokenByType(userId: string, type: string): Promise<{ message: string }> {
    if (!userId || !type) {
      throw new BadRequestException('userId and type are required');
    }

    const updated = await this.dbService.user.findOneAndUpdate(
      { userId },
      { $pull: { fcmTokens: { type } } },
      { new: true }
    ) as UserDocument | null;

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return { message: 'FCM token(s) of this type removed successfully' };
  }


  async deactivateUser(userId: string): Promise<{ message: string }> {
    const updatedUser = await this.dbService.user.findOneAndUpdate(
      { userId },
      { isActive: false },
      { new: true },
    ) as UserDocument | null;

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return { message: 'User deactivated successfully' };
  }

  async activateUser(userId: string): Promise<{ message: string }> {
    const updatedUser = await this.dbService.user.findOneAndUpdate(
      { userId },
      { isActive: true },
      { new: true },
    ) as UserDocument | null;

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return { message: 'User activated successfully' };
  }

  async bootstrapAdminUser(dto: CreateUserDto & { password: string }): Promise<{ message: string; userId: string; accessToken: string }> {
    const { emailId, employeeId, phoneNumber, firstName, lastName, address, divisionId, locationId, userType, permissionGroup, password, profileImageUrl } = dto;

    // Check if any admin user already exists
    const existingAdmin = await this.dbService.user.findOne({
      userType: UserType.ADMIN,
      isActive: true
    }) as UserDocument | null;

    if (existingAdmin) {
      throw new BadRequestException('Admin user already exists. Use regular login.');
    }

    // Check if user already exists
    const existingUser = await this.dbService.user.findOne({
      $or: [
        { emailId },
        ...(employeeId ? [{ employeeId }] : [])
      ]
    }) as UserDocument | null;

    if (existingUser) {
      throw new BadRequestException('User with this email or employee ID already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create admin user in database
    const newUser = await this.dbService.user.create({
      emailId,
      employeeId,
      phoneNumber,
      firstName,
      lastName,
      address,
      divisionId,
      locationId,
      userType: UserType.ADMIN, // Force admin type for bootstrap
      password: hashedPassword,
      permissionGroup: permissionGroup || [],
      profileImageUrl,
      isActive: true,
    }) as UserDocument;

    // Generate JWT token for immediate login
    const { JwtService } = await import('@nestjs/jwt');
    const jwtService = new JwtService({ secret: process.env.JWT_SECRET || 'your-secret-key' });

    const payload = {
      userId: newUser.userId,
      emailId: newUser.emailId,
      employeeId: newUser.employeeId,
      phoneNumber: newUser.phoneNumber,
      userType: newUser.userType,
    };

    const accessToken = jwtService.sign(payload);

    return {
      message: 'Admin user created successfully',
      userId: newUser.userId,
      accessToken,
    };
  }

  async sendPushNotification(userIds: string[], title: string, message: string, data: any, userType: string): Promise<{ message: string }> {
    if (userType === UserType.ADMIN) {
      const admins = await this.dbService.user.find({ userType: UserType.ADMIN, userId: { $nin: userIds } }) as UserDocument[];
      userIds = admins.map(admin => admin.userId);
    }
    if (userType === UserType.MEMBER) {
      const members = await this.dbService.user.find({ userId: { $in: userIds } }) as UserDocument[];
      userIds = members.map(member => member.userId);
    }

    for (const userId of userIds) {
      const user = await this.dbService.user.findOne({ userId: userId }) as UserDocument | null;
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user has FCM tokens
      if (!user.fcmTokens || user.fcmTokens.length === 0) {
        continue
      }

      for (const tokenObj of user.fcmTokens) {

        try {
          await this.notificationService.sendToDevice(tokenObj.token, { title, body: message, data });
          return { message: 'Push notification sent successfully' };
        } catch (error) {
          continue;
        }
      }
    }
  }

  async updateOtp(email: string, otp: string, expiresAt: Date) {
    await this.dbService.user.findOneAndUpdate(
      { emailId: email },
      { otp, otpExpiry: expiresAt },
      { upsert: true }
    );
  }

  async findByEmail(email: string) {
    return this.dbService.user.findOne({ emailId: email });
  }

  async clearOtp(email: string) {
    await this.dbService.user.findOneAndUpdate(
      { emailId: email },
      { otp: null, otpExpiry: null }
    );
  }
  /**
   * Verify OTP from DB
   */
  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const user = await this.findByEmail(email);

    if (!user) {
      return false;
    }

    // Super admin can use default OTP (1234) OR the sent OTP
    if (user.emailId === this.opalSuperAdminEmail && otp === this.SUPER_ADMIN_DEFAULT_OTP) {
      console.log(`Super admin logged in with default OTP`);
      // Clear any existing OTP for security
      if (user.otp) {
        await this.clearOtp(email);
      }
      return true;
    }

    // For all users (including super admin with sent OTP), validate the sent OTP
    if (!user.otp || !user.otpExpiry) {
      return false;
    }

    if (user.otpExpiry < new Date()) {
      console.log(`OTP expired for ${email}`);
      return false;
    }

    if (user.otp !== otp) {
      console.log(`Invalid OTP for ${email}`);
      return false;
    }

    // OTP verified → clear OTP
    await this.clearOtp(email);
    console.log(`OTP verified successfully for ${email}`);
    return true;
  }

  async sendOtp(email: string): Promise<void> {
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 min
    this.emailService.sendOtp(email, otp);

    // Store OTP in user profile
    await this.dbService.user.findOneAndUpdate(
      { emailId: email },
      { otp, otpExpiry: expiresAt },
      { upsert: true }
    );
  }

  private generateOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString(); // 6-digit OTP
  }

  async exportUserMessages(userId: string[], startDate: string, endDate: string): Promise<{ message: string, data: any[] }> {
    try {
      let exportResponse: any[] = [];
      let filters: any = { isActive: true, isDeleted: { $in: [null, false] } };

      if (startDate && endDate) {
        filters.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }

      // Only add userId filter if userIds are provided
      if (userId && userId.length > 0) {
        filters.userId = { $in: userId };
      }

      // Get users with populated master data
      const userDetails = await this.dbService.user.find(filters);
      const users = await this.populateUsersMasterData(userDetails || []);

      if (users.length === 0) {
        return { message: 'No users found', data: [] };
      }

      // Create maps for quick lookup
      const ticketMap = new Map<string, any[]>();
      const messageMap = new Map<string, any[]>();

      // Fetch tickets from chat service
      let ticketsData: any = [];
      try {
        ticketsData = await this.httpClient.get<any>('OPAL_CHAT_SERVICE', '/ticket?nonPaginated=true');
        console.log(ticketsData.length);
      } catch (error) {
        console.error(`Error fetching tickets: ${error}`);
      }

      // Fetch messages from chat service
      let messagesData: any = [];
      try {
        messagesData = await this.httpClient.get<any>('OPAL_CHAT_SERVICE', '/message?nonPaginated=true');
      } catch (error) {
        console.error(`Error fetching messages: ${error}`);
      }

      // Process tickets
      const tickets = Array.isArray((ticketsData as any)?.items) ? (ticketsData as any).items :
        Array.isArray((ticketsData as any)?.items) ? (ticketsData as any).items :
          Array.isArray(ticketsData) ? ticketsData : [];

      tickets.forEach(ticket => {
        if (!ticketMap.has(ticket.userId)) {
          ticketMap.set(ticket.userId, []);
        }
        ticketMap.get(ticket.userId).push(ticket);
      });

      // Process messages
      const messages = Array.isArray((messagesData as any)?.items) ? (messagesData as any).items :
        Array.isArray((messagesData as any)?.items) ? (messagesData as any).items :
          Array.isArray(messagesData) ? messagesData : [];

      messages.forEach(message => {
        if (!messageMap.has(message.senderId)) {
          messageMap.set(message.senderId, []);
        }
        messageMap.get(message.senderId).push(message);
      });

      // Get conversation categories for tickets
      const conversationCategories = await this.recordService.findAll('conversationcategory', {
        nonPaginated: true,
        sort: 'name',
        order: 'asc',
        filters: { isDeleted: false },
      });

      const categoryMap = new Map(
        (conversationCategories?.items || []).map(cat => [cat.conversationCategoryId || cat._id, cat])
      );

      // Create flat export data
      for (const user of users) {
        const userTickets = ticketMap.get(user.userId) || [];
        const userMessages = messageMap.get(user.userId) || [];

        // Create entries for each message
        for (const message of userMessages) {
          // Find the ticket for this message
          const ticket = userTickets.find(t => t.ticketId === message.ticketId);

          // Get conversation category
          const category = ticket ? categoryMap.get(ticket.conversationCategoryId) : null;

          // Format date and time
          const messageDate = new Date(message.createdAt);
          const dateStr = messageDate.toLocaleDateString('en-GB'); // DD/MM/YYYY format
          const timeStr = messageDate.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });

          // Determine message content based on type
          let messageContent = message.messageText || '';
          if (message.messageType === 'video') {
            messageContent = 'Video message';
          } else if (message.messageType === 'audio') {
            messageContent = 'Audio message';
          } else if (message.messageType === 'image') {
            messageContent = 'Image message';
          } else if (message.messageType === 'file') {
            messageContent = 'File message';
          }

          exportResponse.push({
            Category: category?.conversationCategoryName || 'Unknown',
            User: user.employeeId || user.firstName,
            division: user.divisionDetails?.divisionName || 'Unknown',
            Location: user.locationDetails?.locationName || 'Unknown',
            Date: dateStr,
            time: timeStr,
            Message: messageContent
          });
        }

        // If user has tickets but no messages, create entries for the tickets
        if (userTickets.length > 0 && userMessages.length === 0) {
          for (const ticket of userTickets) {
            const category = categoryMap.get(ticket.conversationCategoryId);
            const ticketDate = new Date(ticket.createdAt);
            const dateStr = ticketDate.toLocaleDateString('en-GB');
            const timeStr = ticketDate.toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });

            exportResponse.push({
              Category: category?.conversationCategoryName || category?.categoryName || category?.name || 'Unknown',
              User: user.employeeId || user.userId,
              division: user.divisionDetails?.divisionName || 'Unknown',
              Location: user.locationDetails?.locationName || 'Unknown',
              Date: dateStr,
              time: timeStr,
              Message: ticket.lastMessage || 'Ticket created'
            });
          }
        }
      }

      // Sort by date and time
      exportResponse.sort((a, b) => {
        const dateA = new Date(`${a.Date} ${a.time}`);
        const dateB = new Date(`${b.Date} ${b.time}`);
        return dateA.getTime() - dateB.getTime();
      });

      return { message: 'User messages exported successfully', data: exportResponse };

    } catch (error) {
      console.error('Error exporting user messages:', error);
      throw new Error(`Failed to export user messages: ${error.message}`);
    }
  }
}