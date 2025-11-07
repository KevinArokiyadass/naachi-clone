import { ObjectId, Types } from 'mongoose';

export type UpdatedModel = {
    matchedCount: number;
    modifiedCount: number;
    acknowledged: boolean;
    upsertedId: unknown | ObjectId;
    upsertedCount: number;
};

export type RemovedModel = {
    deletedCount: number;
    deleted: boolean;
};

export type BulkWriteOpResult = {
    insertedCount?: number;
    matchedCount?: number;
    modifiedCount?: number;
    deletedCount?: number;
    upsertedCount?: number;
    upsertedIds?: { [key: number]: Types.ObjectId };
}

export type WriteOperation =
    | { insertOne: { document: any } }
    | { updateOne: { filter: object; update: object } }
    | { deleteOne: { filter: object } };

export type BulkWriteOptions = {
    ordered?: boolean;
    bypassDocumentValidation?: boolean;
    writeConcern?: {
        w?: number | 'majority';
        j?: boolean;
        wtimeout?: number;
    };
}