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

/**
 * True only for "plain" objects (object/array literals). Class instances such as
 * `RegExp`, `Buffer`, `Date`, or a BSON `ObjectId` return false. Operator
 * injection can only arrive via plain objects (e.g. `{ $ne: 5 }`), so these are
 * the only values that need recursive sanitising; special types must be passed
 * through untouched to avoid corrupting the query.
 */
function isPlainObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isOperatorDocument(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    return false;
  }
  const keys = Object.keys(value as Record<string, unknown>);
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

    if (typeof value === 'object') {
      // Plain objects (e.g. an embedded-document equality match) are sanitised
      // recursively so any injected operator keys are stripped. Class instances
      // such as Date, RegExp, Buffer, or a BSON ObjectId are legitimate scalar
      // query values and must be wrapped untouched — running them through
      // sanitizeMongoInput would collapse them to `{ $eq: {} }` and break the query.
      result[key] = isPlainObject(value)
        ? { $eq: sanitizeMongoInput(value) }
        : { $eq: value };
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
