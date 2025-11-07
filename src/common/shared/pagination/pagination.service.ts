import { Injectable } from '@nestjs/common';
import * as momentTz from 'moment-timezone';
import { ASIA_CALCUTTA_TIMEZONE } from '../../../common/constants/service-common.constants';

@Injectable()
export class PaginationService {
  async findAndPaginate(
      collection: any,
      options: {
          filter?: Record<string, any>,
          skip?: number,
          limit?: number,
          projection?: Record<string, any>,
          sort?: Record<string, any>,
          nonPaginated?: boolean
      } = {}
  ) {
      const {
          filter = {},
          skip,
          limit,
          nonPaginated,
          projection = {},
          sort = { _id: -1 }
      } = options;
      const shouldPaginate = !(skip === undefined || skip !== skip || limit === undefined || limit !== limit);
      const isNonPaginated = nonPaginated || !shouldPaginate;
  
      const validatedSkip = skip >= 0 ? skip : 0;
      const validatedLimit = limit > 0 ? limit : 10;

      const query = this.constructQuery(filter);
  
      if (isNonPaginated) {
          // Fetch all items without pagination
          const items = await collection.find(query, projection, { lean: true, sort });
          return {
              totalItems: items.length,
              totalPages: 1,
              skip: 0,
              limit: items.length,
              items,
          };
      } else {
          // Fetch paginated items
          const [items, totalItems] = await Promise.all([
              collection.find(query, projection, { lean: true, sort, skip: validatedSkip, limit: validatedLimit }),
              collection.countDocuments(query),
          ]);
          const totalPages = Math.max(Math.ceil(totalItems / validatedLimit), 1);
  
          return {
              totalItems,
              totalPages,
              skip: validatedSkip,
              limit: validatedLimit,
              items,
          };
      }
  }


  private constructQuery(
      filter: Record<string, any>,
  ): Record<string, any> {
      const query: Record<string, any> = {};
      for (const key in filter) {
          if (filter.hasOwnProperty(key)) {
              this.applyLeadFilters(query, key, filter[key]);
          }
      }
      return query;
  }


    private escapeRegex(term: string): string {
        return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

  private applyLeadFilters(
      query: Record<string, any>,
      key: string,
      value: any,
  ): void {
      if (key === 'search' && typeof value === 'object') {
          const searchFields = value.fields;
          const searchValue = value.term;
          if (searchValue) {
              if (searchValue instanceof Array) {
                  query.$or = searchFields.map((field) => ({
                      [field]: { $in: searchValue.map((value) => new RegExp(this.escapeRegex(value), 'i')) },
                  }));
              } else {
                  query.$or = searchFields.map((field) => ({
                      [field]: new RegExp(this.escapeRegex(searchValue), 'i'),
                  }));
              }
          }
      } else if (Array.isArray(value)) {
          if (key.includes('$')) {
              query[key] = value;
          } else {
              query[key] = { $in: value };
          }
      } else if (typeof value === 'object') {
          if (value.from || value.to) {
              this.addDynamicDateFilter(query, key, value);
          } else if (value.$regex) {
              query[key] = {
                  $regex: value.$regex,
                  $options: value.$options || 'i'
              };
          } else {
              query[key] = value;
          }
      } else {
          query[key] = value;
      }
  }

  private addDynamicDateFilter(
      query: Record<string, any>,
      key: string,
      dateFilter: { from?: string; to?: string },
  ): void {
      const { from, to } = dateFilter;
      const fromDate = from ? momentTz.tz(new Date(from), ASIA_CALCUTTA_TIMEZONE).startOf('day') : null;
      const toDate = to ? momentTz.tz(new Date(to), ASIA_CALCUTTA_TIMEZONE).endOf('day') : fromDate;

      if (fromDate?.isValid() && toDate?.isValid()) {
          query[key] = {
              $gte: fromDate.toDate(),
              $lt: toDate.toDate(),
          };
      } else {
          console.log('No valid from or to dates provided for dynamic filtering');
      }
  }

}
