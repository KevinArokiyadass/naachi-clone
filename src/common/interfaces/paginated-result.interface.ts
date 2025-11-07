export interface IPaginatedResult<T> {
    items: T[];
    totalItems: number;
    totalPages: number;
  }