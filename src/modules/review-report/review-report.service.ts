import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateReviewReportDto } from './dto/create-review-report.dto';
import { UpdateReviewReportDto } from './dto/update-review-report.dto';
import { ReviewReport, Report } from './entities/review-report.entity';
import { generateUniqueId } from 'src/common/utils/util';
import { PaginationService } from 'src/common/shared/pagination/pagination.service';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { Users } from 'src/modules/users/entity/users.entity';
import { accountStatus } from 'src/common/enums/user.enum';
import { HttpClientService } from 'src/common/inter-service-communication/http-client.service';
import { IMongoDBServices } from 'src/common/repository/mongodb-repository/abstract.repository';
@Injectable()
export class ReviewReportService {

  constructor(
    @InjectModel(ReviewReport.name)
    private readonly reportModel: Model<Report>,
    @InjectModel(Users.name)
    private readonly usersModel: Model<Users>,
    private readonly paginationService: PaginationService,
    private readonly httpClientService: HttpClientService,
    private readonly dbService: IMongoDBServices,
  ) { }

  private async validateConnection(reporterId: string, reportedUserId: string): Promise<string> {
    try {
      const response: any = await this.httpClientService.get(
        'NAACHI_CHAT_SERVICE',
        '/connection',
        { ownerId: reporterId, skip: 0, limit: 10 }
      );

      console.log('Chat service response:', JSON.stringify(response, null, 2));

      // Handle different response structures
      const items = response?.items || response?.result?.items;

      if (!items || items.length === 0) {
        console.log('No items found in response. Response structure:', {
          hasItems: !!response?.items,
          hasResultItems: !!response?.result?.items,
          responseKeys: response ? Object.keys(response) : []
        });
        throw new BadRequestException(
          `No connection found for reporter ${reporterId}`
        );
      }

      const connection = items.find(
        (conn: any) => conn.peerId === reportedUserId
      );

      if (!connection) {
        throw new BadRequestException(
          `No connection found between reporter ${reporterId} and reported user ${reportedUserId}`
        );
      }

      return connection.connectionId;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to validate connection: ${error.message}`
      );
    }
  }

  private async blockUserConnection(connectionId: string, ownerId: string): Promise<any> {
    try {
      const response = await this.httpClientService.patch(
        'NAACHI_CHAT_SERVICE',
        `/connection/${connectionId}`,
        {
          ownerId,
          isBlocked: true,
          blockReason: 'Spam'
        }
      );

      return response;
    } catch (error) {
      throw new BadRequestException(
        `Failed to block connection: ${error.message}`
      );
    }
  }

  async create(dto: CreateReviewReportDto): Promise<ReviewReport> {
    const connectionId = await this.validateConnection(
      dto.reporterId,
      dto.reportedUserId
    );

    await this.blockUserConnection(connectionId, dto.reporterId);

    const evidenceMessages =
      dto.evidenceMessages?.map((msg) => ({
        messageId: msg.messageId,
      })) || [];

    const createdReport = new this.reportModel({
      ...dto,
      reviewId: generateUniqueId(),
      evidenceMessages,
    });

    return createdReport.save();
  }

  async findAll(
    skip: number = 0,
    limit: number = 10,
    filter: Record<string, any> = {},
    nonPaginated: boolean = false
  ): Promise<IPaginatedResult<any>> {
    const result = await this.paginationService.findAndPaginate(
      this.reportModel,
      {
        skip,
        limit,
        filter,
        nonPaginated,
        sort: { createdAt: -1 }
      }
    );

    if (result.items && Array.isArray(result.items) && result.items.length > 0) {
      const reporterIds = [...new Set(result.items.map((r: any) => {
        const id = r.reporterId;
        return id ? (typeof id === 'string' ? id : id.toString()) : null;
      }).filter(Boolean))];
      const reportedUserIds = [...new Set(result.items.map((r: any) => {
        const id = r.reportedUserId;
        return id ? (typeof id === 'string' ? id : id.toString()) : null;
      }).filter(Boolean))];
      const allUserIds = [...new Set([...reporterIds, ...reportedUserIds])];

      // Fetch all users in one query by userId field
      const users = await this.usersModel.find(
        { userId: { $in: allUserIds } },
        { userId: 1, userName: 1, name: 1, _id: 0 }
      ).lean().exec();

      // Create a map for quick lookup
      const userMap = new Map(users.map((u: any) => [u.userId, u]));

      const populatedItems = result.items.map((report: any) => {
        const reporterId = report.reporterId ? (typeof report.reporterId === 'string' ? report.reporterId : report.reporterId.toString()) : null;
        const reportedUserId = report.reportedUserId ? (typeof report.reportedUserId === 'string' ? report.reportedUserId : report.reportedUserId.toString()) : null;
        const reporter = reporterId ? userMap.get(reporterId) : null;
        const reportedUser = reportedUserId ? userMap.get(reportedUserId) : null;

        return {
          reviewId: report.reviewId,
          reasonCodeId: report.reasonCodeId,
          reasonText: report.reasonText,
          conversationId: report.conversationId,
          status: report.status,
          evidenceMessages: report.evidenceMessages,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          reporterId: reporter?.userId || reporterId,
          reporterUsername: reporter?.userName,
          reporterName: reporter?.name,
          reportedUserId: reportedUser?.userId || reportedUserId,
          reportedUsername: reportedUser?.userName,
          reportedName: reportedUser?.name,
        };
      });

      return {
        ...result,
        items: populatedItems,
      };
    }

    return result;
  }

  async findOne(reviewId: string): Promise<any> {
    const reportArr = await this.reportModel.aggregate([
      { $match: { reviewId } },

      {
        $lookup: {
          from: 'users',
          localField: 'reporterId',
          foreignField: 'userId',
          as: 'reporter',
        },
      },
      { $unwind: { path: '$reporter', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'users',
          localField: 'reportedUserId',
          foreignField: 'userId',
          as: 'reportedUser',
        },
      },
      { $unwind: { path: '$reportedUser', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          reviewId: 1,
          reasonCodeId: 1,
          reasonText: 1,
          conversationId: 1,
          status: 1,
          evidenceMessages: 1,
          createdAt: 1,
          updatedAt: 1,
          reporter: 1,
          reportedUser: 1,
        },
      },
    ]);
    if (!reportArr || reportArr.length === 0) {
      throw new NotFoundException(`ReviewReport with reviewId ${reviewId} not found`);
    }
  
    const report = reportArr[0];
  
    if (report.conversationId) {
      try {
        const messageResponse: any = await this.httpClientService.get(
          'NAACHI_CHAT_SERVICE',
          '/message',
          { ticketId: report.conversationId }
        );
  
        const messages =
          messageResponse?.items ||
          messageResponse?.result ||
          messageResponse ||
          [];
  
        if (Array.isArray(messages)) {
          report.evidenceMessages = messages
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .slice(0, 5);
        } else {
          report.evidenceMessages = [];
        }
      } catch (error) {
        console.error(
          `Failed to fetch evidence messages for reviewId ${reviewId}:`,
          error.message,
        );
      }
    }
  
    return report;
  }

  async update(reviewId: string, dto: UpdateReviewReportDto): Promise<ReviewReport> {
    if (dto.evidenceMessages) {
      dto.evidenceMessages = dto.evidenceMessages.map((msg) => ({
        messageId: msg.messageId || generateUniqueId(),
      }));
    }

    const updatedReport = await this.reportModel
      .findOneAndUpdate({ reviewId }, dto, { new: true })
      .exec();
    if (!updatedReport) {
      throw new NotFoundException(`ReviewReport with reviewId ${reviewId} not found`);
    }
    return updatedReport;
  }

  async updateStatus(reviewId: string, status: string): Promise<ReviewReport> {
    const updated = await this.reportModel
      .findOneAndUpdate(
        { reviewId },
        { status },
        { new: true }
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`ReviewReport with reviewId ${reviewId} not found`);
    }

    if (
      status.toLowerCase() === 'resolved' &&
      updated.reportedUserId
    ) {
      await this.usersModel
        .findOneAndUpdate(
          { userId: updated.reportedUserId },
          {
            status: accountStatus.BLOCKED,
          },
          { new: true }
        )
        .exec();
    }

    return updated;
  }

  async delete(reviewId: string): Promise<{ message: string }> {
    const deleted = await this.reportModel.findOneAndDelete({ reviewId }).exec();
    if (!deleted) {
      throw new NotFoundException(`ReviewReport with reviewId ${reviewId} not found`);
    }
    return { message: 'ReviewReport deleted successfully' };
  }
}