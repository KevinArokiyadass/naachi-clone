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
        content: msg.content,
      })) || [];

    const createdReport = new this.reportModel({
      ...dto,
      reviewId: generateUniqueId(),
      evidenceMessages,
    });

    return createdReport.save();
  }

  async findAll(): Promise<ReviewReport[]> {
    return this.reportModel.find().sort({ createdAt: -1 });
  }

  async findOne(id: string): Promise<ReviewReport> {
    const report = await this.reportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException(`ReviewReport with ID ${id} not found`);
    }
    return report;
  }

  async update(id: string, dto: UpdateReviewReportDto): Promise<ReviewReport> {
    if (dto.evidenceMessages) {
      dto.evidenceMessages = dto.evidenceMessages.map((msg) => ({
        messageId: msg.messageId || generateUniqueId(),
        content: msg.content,
      }));
    }

    const updatedReport = await this.reportModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updatedReport) {
      throw new NotFoundException(`ReviewReport with ID ${id} not found`);
    }
    return updatedReport;
  }

  async delete(id: string): Promise<{ message: string }> {
    const deleted = await this.reportModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`ReviewReport with ID ${id} not found`);
    }
    return { message: 'ReviewReport deleted successfully' };
  }
}
