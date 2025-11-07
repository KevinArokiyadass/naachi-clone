import { IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class DateFilterDto {
    @IsString()
    startDate: string;
    @IsString()
    endDate: string;
}

export class AnalyticsFilterDto {

    @IsOptional()
    @IsString()
    divisionId?: string;

    @IsOptional()
    @IsString()
    locationId?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => DateFilterDto)
    date?: DateFilterDto;

}


export class AnalyticsFilterResponseDto {
    totalUsers: number;
    totalNumberOfTickets: number;
    totalNumberOfOpenTickets: number;
    totalNumberOfClosedTickets: number;
    totalNumberOfInProgressTickets: number;
    categorySummary: CategorySummaryResponseDto[];
    analyticsGraph: AnalyticsGraphResponseDto;
}

export class CategorySummaryResponseDto {
    name: string;
    ticketCount: number;
}
export class AnalyticsGraphResponseDto{
    totalCount: number;
    createdAt: Date[];
}
