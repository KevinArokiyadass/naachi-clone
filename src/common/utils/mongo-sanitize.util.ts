import { FilterQuery } from 'mongoose';

const OPERATOR_KEY = /^\$/;

/**
 * Removes keys starting with `$` from user-controlled payloads (query/body/params).
 * Prevents NoSQL injection such as `?userId[$ne]=5`.
 */
export function sanitizeMongoInput<T>(input: T): T {
  if (input instanceof Date) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeMongoInput(item)) as T;
  }

  if (input !== null && typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (OPERATOR_KEY.test(key)) {
        continue;
      }
      result[key] = sanitizeMongoInput(value);
    }
    return result as T;
  }

  return input;
}

function isOperatorDocument(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => OPERATOR_KEY.test(key));
}

/**
 * Hardens Mongo filter objects before they reach Mongoose:
 * - scalar values are wrapped with `$eq` so object injection cannot alter operators
 * - intentional operator documents (e.g. `{ $ne: true }`) are preserved
 * - logical clauses (`$or`, `$and`, `$nor`) are processed recursively
 */
export function prepareMongoFilter<T>(filter: FilterQuery<T>): FilterQuery<T> {
  if (filter === null || filter === undefined) {
    return filter;
  }

  if (typeof filter !== 'object' || filter instanceof Date) {
    return filter;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filter as Record<string, unknown>)) {
    if (OPERATOR_KEY.test(key)) {
      if ((key === '$or' || key === '$and' || key === '$nor') && Array.isArray(value)) {
        result[key] = value.map((branch) => prepareMongoFilter(branch as FilterQuery<T>));
      } else {
        result[key] = value;
      }
      continue;
    }

    if (isOperatorDocument(value)) {
      result[key] = value;
      continue;
    }

    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = { $in: value };
      continue;
    }

    if (typeof value === 'object' && !(value instanceof Date)) {
      result[key] = { $eq: sanitizeMongoInput(value) };
      continue;
    }

    result[key] = { $eq: value };
  }

  return result as FilterQuery<T>;
}

/** Ensures a value intended for a query field is a primitive (not an operator object). */
export function assertQueryPrimitive(
  value: unknown,
  fieldName: string,
): string | number | boolean | null | undefined {
  if (value === null) {
    return null;
  }
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  throw new Error(`${fieldName} must be a primitive query value`);
}
