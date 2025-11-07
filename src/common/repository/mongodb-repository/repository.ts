import { AggregateOptions, FilterQuery, Model, PipelineStage, ProjectionType, QueryOptions, UpdateQuery } from "mongoose";
import { BulkWriteOpResult, UpdatedModel, WriteOperation } from "./mongo-lib.types";
import { IMongoRepository } from "./repository.abstract";

export class MongoRepository<T, K, L> implements IMongoRepository<T, K, L> {
    private _repository: Model<T>;

    constructor(repository: Model<T>) {
        this._repository = repository;
    }

    async findOne(filters: FilterQuery<T>, projections?: ProjectionType<T>, options?: QueryOptions<T>): Promise<K> {
        const result = await this._repository.findOne(filters, projections, options).lean();
        return result as unknown as K;
    }

    async find(filters: FilterQuery<T>, projections?: ProjectionType<T>, options?: QueryOptions<T>): Promise<K[]> {
        const result = await this._repository.find(filters, projections, options).lean();
        return result as unknown as K[];
    }

    async findOneAndUpdate(filters: FilterQuery<T>, updateQuery: UpdateQuery<T>, options?: QueryOptions<T>): Promise<K> {
        const result = await this._repository.findOneAndUpdate(filters, updateQuery, options).lean();
        return result as unknown as K;
    }

    async findOneAndDelete(filters: FilterQuery<T>, options?: QueryOptions<T>): Promise<K> {
        const result = await this._repository.findOneAndDelete(filters, options).lean();
        return result as unknown as K;
    }

    updateMany(filters: FilterQuery<T>, updateQuery: UpdateQuery<T>): Promise<UpdatedModel> {
        return this._repository.updateMany(filters, updateQuery);
    }

    async countDocuments(filters: FilterQuery<T>, options?: QueryOptions<T>): Promise<number> {
        return this._repository.countDocuments(filters, options as any);
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
        return this._repository.distinct(field, filters);
    }

    async deleteMany(operation: FilterQuery<T>): Promise<{ deletedCount: number }> {
        return this._repository.deleteMany(operation);
    }

    async insertMany(payload: Partial<K>[]): Promise<K[]> {
        const result = await this._repository.insertMany(payload);
        return result as unknown as K[];
    }
}
