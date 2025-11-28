import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReviewReportDto, UpdateReviewReportDto } from './dto/review-report.dto';
import { ReviewReport } from './entities/review-report.entity';

@Injectable()
export class ReviewReportService {

  constructor(
    @InjectModel(ReviewReport.name)
    private reportModel: Model<ReviewReport>
  ) { }

  async create(dto: ReviewReportDto) {
    const newReport = new this.reportModel({ ...dto });
    return newReport.save();
}
  async findAll() {
    return this.reportModel.find().sort({ createdAt: -1 });
  }

  async findOne(id: string) {
    const report = await this.reportModel.findById(id);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }

  async update(id: string, dto: UpdateReviewReportDto) {
    const updated = await this.reportModel.findByIdAndUpdate(id, dto, { new: true });
    if (!updated) throw new NotFoundException('Report npot found');
    return updated;
  }

  async delete(id: string) {
    const deleted = await this.reportModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException('Report not found');
    }
    return deleted;
  }
}
