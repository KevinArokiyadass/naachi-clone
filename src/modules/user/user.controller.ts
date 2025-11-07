import * as ExcelJS from 'exceljs';
import * as momentTz from 'moment-timezone';
import { Body, Controller, Get, Patch, Post, Req, Query, Param, Put, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, CreateAdminDto } from './dto/signup.dto';
import { UpdateUserDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { LogoutDto } from './dto/logout.dto';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) { }

  @Post('analytics')
  @ApiOperation({ summary: 'Filter analytics by Division and Location' })
  @ApiResponse({ status: 200, description: 'Filtered Analytics Data' })
  async createAnalytics(@Body() dto: AnalyticsFilterDto) {
    return await this.userService.getFilteredAnalytics(dto);
  }

  @Get('locations-divisions')
  @ApiOperation({ summary: 'Get all unique locations and divisions from master data' })
  @ApiResponse({
    status: 200,
    description: 'List of locations and divisions with IDs and names',
    schema: {
      type: 'object',
      properties: {
        locations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              locationId: { type: 'string' },
              locationName: { type: 'string' }
            }
          }
        },
        divisions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              divisionId: { type: 'string' },
              divisionName: { type: 'string' }
            }
          }
        }
      }
    }
  })
  async getLocationsAndDivisions() {
    return await this.userService.getLocationsAndDivisions();
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    const user = req.user;
    return await this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  // Bootstrap Admin User (No Auth Required)
  @Post('bootstrap-admin')
  @ApiOperation({ summary: 'Create initial admin user (Bootstrap only - no auth required)' })
  @ApiResponse({ status: 201, description: 'Admin user created successfully with JWT token' })
  @ApiResponse({ status: 400, description: 'Admin user already exists or validation error' })
  async bootstrapAdminUser(@Body() dto: CreateUserDto & { password: string }) {
    return await this.userService.bootstrapAdminUser(dto);
  }

  // Admin User Management Endpoints
  @Post('create')
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(@Body() dto: CreateUserDto) {
    return await this.userService.createUser(dto);
  }

  @Post('create-admin')
  @ApiOperation({ summary: 'Create a new admin user (Admin only)' })
  @ApiResponse({ status: 201, description: 'Admin user created successfully' })
  async createAdminUser(@Body() dto: CreateAdminDto) {
    return await this.userService.createAdminUser(dto);
  }

  @UseInterceptors(FileInterceptor('file'))
  @Post('create-member')
  @ApiOperation({ summary: 'Create a new member user (Admin only). Supports JSON body or Excel file upload.' })
  @ApiResponse({ status: 201, description: 'Member user(s) created successfully' })
  async createMemberUser(@UploadedFile() file: Express.Multer.File, @Body() dto: any) {
    if (file?.buffer?.length) {
      return await this.userService.createMembersFromExcel(file.buffer);
    }
    return await this.userService.createMemberUser(dto);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user and remove FCM token by type' })
  @ApiResponse({ status: 200, description: 'FCM token removed successfully' })
  async logout(@Body() dto: LogoutDto) {
    if (!dto.userId) {
      throw new BadRequestException('userId is required');
    }
    return this.userService.removeFcmTokenByType(dto.userId, dto.type);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users with pagination and enriched data' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully with pagination' })
  async getUsers(@Query() query: {
    skip?: number;
    limit?: number;
    search?: string;
    userType?: string;
    locationId?: string;
    divisionId?: string;
    nonPaginated?: boolean;
  }, @Req() req: any) {
    const skip = parseInt(String(query?.skip)) || 0;
    const limit = parseInt(String(query?.limit)) || 10;
    const nonPaginated = query?.nonPaginated === true;
    const filter: any = {};

    if (query?.search) {
      filter.$or = [
        { firstName: { $regex: query.search, $options: 'i' } },
        { lastName: { $regex: query.search, $options: 'i' } },
        { emailId: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
        { phoneNumber: { $regex: query.search, $options: 'i' } },
        { address: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query?.userType) {
      filter.userType = query.userType;
    }
    if (query?.locationId) {
      filter.locationId = query.locationId;
    }
    if (query?.divisionId) {
      filter.divisionId = query.divisionId;
    }

    return await this.userService.getAllUsers(skip, limit, filter, nonPaginated);
  }

  // Admin endpoint to update any user's profile....
  @Put(':userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User profile updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate email/employee ID/phone number' })
  async updateUserById(@Param('userId') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateUser(userId, dto);
  }

  // User endpoint to update their own profile
  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate email/employee ID/phone number' })
  async updateOwnProfile(@Body() dto: UpdateUserDto, @Req() req: any) {
    const user = req.user;
    return this.userService.updateUser(user.userId, dto);
  }

  @Get('by-type/:userType')
  @ApiOperation({ summary: 'Get users by userType (Admin only)' })
  async getUsersByType(@Param('userType') userType: string, @Query() query: { skip?: number; limit?: number; search?: string }) {
    const skip = parseInt(String(query.skip)) || 0;
    const limit = parseInt(String(query.limit)) || 10;
    const filter: any = { userType };

    if (query.search) {
      filter.$or = [
        { firstName: { $regex: query.search, $options: 'i' } },
        { lastName: { $regex: query.search, $options: 'i' } },
        { emailId: { $regex: query.search, $options: 'i' } },
        { employeeId: { $regex: query.search, $options: 'i' } },
        { phoneNumber: { $regex: query.search, $options: 'i' } },
        { address: { $regex: query.search, $options: 'i' } },
      ];
    }

    return await this.userService.getAllUsers(skip, limit, filter);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  async getUserById(@Param('userId') userId: string) {
    return this.userService.getUser(userId);
  }

  @Put(':userId/deactivate')
  @ApiOperation({ summary: 'Deactivate user (Admin only)' })
  async deactivateUser(@Param('userId') userId: string) {
    return this.userService.deactivateUser(userId);
  }

  @Put(':userId/activate')
  @ApiOperation({ summary: 'Activate user (Admin only)' })
  async activateUser(@Param('userId') userId: string) {
    return this.userService.activateUser(userId);
  }

  @Post('push-notification')
  @ApiOperation({ summary: 'Send push notification to users by userId' })
  async sendPushNotification(@Body() dto: { userIds: string[], title: string, message: string, data: any, userType: string }) {
    return this.userService.sendPushNotification(dto.userIds, dto.title, dto.message, dto.data, dto.userType);
  }

  @Post('export')
  @ApiOperation({ summary: 'Export user messages to Excel format' })
  @ApiResponse({ status: 200, description: 'Excel file with user messages exported successfully' })
  async exportUserMessages(
    @Body() dto: { userId: string[], startDate: string, endDate: string }, @Res() res: any) {
    const result = await this.userService.exportUserMessages(dto.userId, dto.startDate, dto.endDate);
    const exportData = result.data;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tickets Report');

    // Set column widths
    worksheet.columns = [
      { key: 'category', width: 25 },
      { key: 'user', width: 20 },
      { key: 'division', width: 20 },
      { key: 'location', width: 25 },
      { key: 'date', width: 15 },
      { key: 'time', width: 10 },
      { key: 'message', width: 50 }
    ];

    // Add report header - left aligned
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'Tickets Report';
    worksheet.getCell('A1').font = { bold: true, size: 20 };
    worksheet.getCell('A1').alignment = { horizontal: 'left' };

    // Add report info - left aligned
    worksheet.mergeCells('A2:G2');
    worksheet.getCell('A2').value = `Generated on: ${momentTz.tz().format('DD-MM-YYYY HH:mm:ss')}`;
    worksheet.getCell('A2').font = { size: 12 };
    worksheet.getCell('A2').alignment = { horizontal: 'left' };

    // Empty row
    worksheet.addRow([]);

    const tableStartRow = 4;

    // Add Table Header Row with consistent styling
    const headerRow = worksheet.getRow(tableStartRow);
    headerRow.values = [
      'Category',
      'User',
      'Division',
      'Location',
      'Date',
      'Time',
      'Message'
    ];

    // Apply consistent styling to all header cells
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } }
      };
    });

    // Add data rows
    exportData.forEach((row: any) => {
      worksheet.addRow({
        category: row.Category,
        user: row.User,
        division: row.division,
        location: row.Location,
        date: row.Date,
        time: row.time,
        message: row.Message
      });
    });

    // Style the data rows
    for (let i = tableStartRow + 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.alignment = { horizontal: 'left', vertical: 'middle' };

      // Alternate row colors
      if (i % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        };
      }
    }

    // Add borders to all cells
    const range = worksheet.getCell(`A${tableStartRow}:G${worksheet.rowCount}`);

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      if (column.eachCell) {
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
      }
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });

    // Set filename with timestamp
    const timestamp = momentTz.tz().format('DD-MM-YYYY_HH-mm-ss');
    const filename = `Tickets_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${filename}`
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();
  }
} 
