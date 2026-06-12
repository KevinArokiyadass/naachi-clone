import { AggregateOptions, FilterQuery, Model, PipelineStage, ProjectionType, QueryOptions, UpdateQuery } from "mongoose";
import { BulkWriteOpResult, UpdatedModel, WriteOperation } from "./mongo-lib.types";
import { IMongoRepository } from "./repository.abstract";
import { prepareMongoFilter } from "../../utils/mongo-sanitize.util";

export class MongoRepository<T, K, L> implements IMongoRepository<T, K, L> {
    private _repository: Model<T>;

    constructor(repository: Model<T>) {
        this._repository = repository;
    }

    private safeFilter(filters: FilterQuery<T>): FilterQuery<T> {
        return prepareMongoFilter(filters);
    }

    async findOne(filters: FilterQuery<T>, projections?: ProjectionType<T>, options?: QueryOptions<T>): Promise<K> {
        const result = await this._repository.findOne(this.safeFilter(filters), projections, options).lean();
        return result as unknown as K;
    }

    async find(filters: FilterQuery<T>, projections?: ProjectionType<T>, options?: QueryOptions<T>): Promise<K[]> {
        const result = await this._repository.find(this.safeFilter(filters), projections, options).lean();
        return result as unknown as K[];
    }

    async findOneAndUpdate(filters: FilterQuery<T>, updateQuery: UpdateQuery<T>, options?: QueryOptions<T>): Promise<K> {
        const result = await this._repository.findOneAndUpdate(this.safeFilter(filters), updateQuery, options).lean();
        return result as unknown as K;
    }

    async findOneAndDelete(filters: FilterQuery<T>, options?: QueryOptions<T>): Promise<K> {
        const result = await this._repository.findOneAndDelete(this.safeFilter(filters), options).lean();
        return result as unknown as K;
    }

    updateMany(filters: FilterQuery<T>, updateQuery: UpdateQuery<T>): Promise<UpdatedModel> {
        return this._repository.updateMany(this.safeFilter(filters), updateQuery);
    }

    async countDocuments(filters: FilterQuery<T>, options?: QueryOptions<T>): Promise<number> {
        return this._repository.countDocuments(this.safeFilter(filters), options as any);
    }

    async create(payload: Partial<K>): Promise<L> {
        const instance = new this._repository(payload);
        const savedInstance = await instance.save();
        return savedInstance.toJSON() as L;
    }

    async aggregate<L>(pipeline: PipelineStage[], options?: AggregateOptions): Promise<L[]> {
        return this._repository.aggregate(pipeline, options);
    }

    bulkWrite(operations: WriteOperation[]): Promise<BulkWriteOpResult> {
        return this._repository.bulkWrite(operations);
    }

    async distinct(field: string, filters?: FilterQuery<T>): Promise<any[]> {
        return this._repository.distinct(field, filters ? this.safeFilter(filters) : filters);
    }

    async deleteMany(operation: FilterQuery<T>): Promise<{ deletedCount: number }> {
        return this._repository.deleteMany(this.safeFilter(operation));
    }

    async insertMany(payload: Partial<K>[]): Promise<K[]> {
        const result = await this._repository.insertMany(payload);
        return result as unknown as K[];
    }
}
