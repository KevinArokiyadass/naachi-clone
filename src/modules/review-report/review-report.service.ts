import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateReviewReportDto } from './dto/create-review-report.dto';
import { UpdateReviewReportDto } from './dto/update-review-report.dto';
import { ReviewReport, Report } from './entities/review-report.entity';
import { generateUniqueId } from 'src/common/utils/util';

@Injectable()
export class ReviewReportService {

  constructor(
    @InjectModel(ReviewReport.name)
    private readonly reportModel: Model<Report>,
  ) {}

  async create(dto: CreateReviewReportDto): Promise<ReviewReport> {
    const evidenceMessages =
      dto.evidenceMessages?.map((msg) => ({
        messageId: msg.messageId || generateUniqueId(),
      })) || [];

    const createdReport = new this.reportModel({
      ...dto,
      reviewId: generateUniqueId(),
      evidenceMessages,
    });

    return createdReport.save();
  }

  async findAll(): Promise<ReviewReport[]> {
    const reports = await this.reportModel.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'reporterId',
          foreignField: 'userId',
          as: 'reporter',
        },
      },
      { $unwind: '$reporter' },
  
      {
        $lookup: {
          from: 'users',
          localField: 'reportedUserId',
          foreignField: 'userId',
          as: 'reportedUser',
        },
      },
      { $unwind: '$reportedUser' },
  
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
  
          reporterId: '$reporter.userId',
          reporterUsername: '$reporter.userName',
          reporterName: '$reporter.Name',
  
          reportedUserId: '$reportedUser.userId',
          reportedUsername: '$reportedUser.userName',
          reportedName: '$reportedUser.Name',
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  
    return reports;
  }

  async findOne(reviewId: string): Promise<ReviewReport> {
    const report = await this.reportModel.aggregate([
      { $match: { reviewId } },
  
      {
        $lookup: {
          from: 'users',
          localField: 'reporterId',
          foreignField: 'userId',
          as: 'reporter',
        },
      },
      { $unwind: '$reporter' },
  
      {
        $lookup: {
          from: 'users',
          localField: 'reportedUserId',
          foreignField: 'userId',
          as: 'reportedUser',
        },
      },
      { $unwind: '$reportedUser' },
  
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
          reporterId: '$reporter.userId',
          reporterUsername: '$reporter.userName',
          reporterName: '$reporter.Name',
          reportedUserId: '$reportedUser.userId',
          reportedUsername: '$reportedUser.userName',
          reportedName: '$reportedUser.Name',
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  
    if (!report || report.length === 0) {
      throw new NotFoundException(`ReviewReport with reviewId ${reviewId} not found`);
    }
  
    return report[0];
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