import { AggregateOptions, FilterQuery, PipelineStage, ProjectionType, QueryOptions, UpdateQuery } from "mongoose";
import { BulkWriteOpResult, UpdatedModel, WriteOperation } from "./mongo-lib.types";

export abstract class IMongoRepository<T, K, L> {

    abstract findOne(filters: FilterQuery<T>, projections?: ProjectionType<T>, options?: QueryOptions<T>): Promise<K>;

    abstract find(filters: FilterQuery<T>, projections?: ProjectionType<T>, options?: QueryOptions<T>): Promise<K[]>;

    abstract findOneAndUpdate(filters: FilterQuery<T>, updateQuery: UpdateQuery<T>, options?: QueryOptions<T>): Promise<K>;

    abstract findOneAndDelete(filters: FilterQuery<T>, options?: QueryOptions<T>): Promise<K>;

    abstract updateMany(filters: FilterQuery<T>, updateQuery: UpdateQuery<T>): Promise<UpdatedModel>;

    abstract countDocuments(filters: FilterQuery<T>, options?: QueryOptions<T>): Promise<number>;

    abstract create(payload: Partial<K>): Promise<L>;

    abstract aggregate<L>(pipeline: PipelineStage[], options?: AggregateOptions): Promise<L[]>;

    abstract bulkWrite(operations: WriteOperation[]): Promise<BulkWriteOpResult>;

    abstract distinct(field: string, filters?: FilterQuery<T>): Promise<any[]>;

    abstract deleteMany(filters: FilterQuery<T>): Promise<{ deletedCount: number }>;

    abstract insertMany(payload: Partial<K>[]): Promise<K[]>;
}
