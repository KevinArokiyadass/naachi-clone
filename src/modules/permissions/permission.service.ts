import { Injectable } from '@nestjs/common';
import { RecordService } from '@noukha-technologies/mdm-core';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';

@Injectable()
export class PermissionService {
  constructor(private readonly recordService: RecordService) {}

  async createPermission(data: any, institutionsId?: string) {
    const recordData = { ...data };
    if (institutionsId) {
      recordData.institutionsId = institutionsId;
    }
    // CreateRecordDto expects { data: Record<string, any> }
    return await this.recordService.createRecord('permissions', { data: recordData });
  }

  async updatePermission(id: string, data: any, institutionsId?: string) {
    const recordData = { ...data };
    if (institutionsId) {
      recordData.institutionsId = institutionsId;
    }
    // UpdateRecordDto expects { data: Record<string, any> }
    return await this.recordService.updateRecord('permissions', id, { data: recordData });
  }

  async replacePermission(id: string, data: any, institutionsId?: string) {
    const recordData = { ...data };
    if (institutionsId) {
      recordData.institutionsId = institutionsId;
    }
    // RecordService doesn't have replace, so we use updateRecord which will replace the entire record
    // UpdateRecordDto expects { data: Record<string, any> }
    return await this.recordService.updateRecord('permissions', id, { data: recordData });
  }

  async getPermissions(
    institutionsId: string,
    skip: number = 0,
    limit: number = 10,
    search?: string,
    nonPaginated: boolean = false,
    sort: string = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ): Promise<IPaginatedResult<any> & { skip: number; limit: number }> {
    let filters: Record<string, any> = {
      institutionsId: institutionsId,
      isDeleted: false,
    }; 

    if(!institutionsId) {
      filters['institutionsId'] = {$exists: false};
    }
    console.log(filters);

    if (search && search.trim()) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { permissionsId: { $regex: search, $options: 'i' } },
      ];
    }

    try {
      let result = await this.recordService.findAll('permissions', {
        filters,
        nonPaginated: true,
      });

      let allItems = result?.items || [];

      if (allItems.length === 0) {
        filters = { institutionsId: institutionsId };
        if (search && search.trim()) {
          filters.$or = [
            { name: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } },
            { permissionsId: { $regex: search, $options: 'i' } },
          ];
        }
        result = await this.recordService.findAll('permissions', {
          filters,
          nonPaginated: true,
        });
        allItems = result?.items || [];
      }

      allItems = allItems.filter((item: any) => {
        return item.isDeleted === false || item.isDeleted === null || item.isDeleted === undefined;
      });


      if (search && search.trim() && (!filters.$or || allItems.length > 0)) {
        const searchLower = search.toLowerCase();
        const filteredItems = allItems.filter((item: any) => {
          const nameMatch = item.name?.toLowerCase().includes(searchLower);
          const codeMatch = item.code?.toLowerCase().includes(searchLower);
          const permissionsIdMatch = item.permissionsId?.toLowerCase().includes(searchLower);
          return nameMatch || codeMatch || permissionsIdMatch;
        });
        if (filteredItems.length !== allItems.length || allItems.length === 0) {
          allItems = filteredItems;
        }
      }


      if (sort && allItems.length > 0) {
        const sortOrder = order === 'asc' ? 1 : -1;
        allItems.sort((a: any, b: any) => {
          const aValue = a[sort] || '';
          const bValue = b[sort] || '';
          if (aValue < bValue) return -1 * sortOrder;
          if (aValue > bValue) return 1 * sortOrder;
          return 0;
        });
      }

      const totalItems = allItems.length;


      if (nonPaginated) {
        return {
          items: allItems,
          totalItems,
          totalPages: 1,
          skip: 0,
          limit: totalItems,
        };
      } else {
        const validatedSkip = skip >= 0 ? skip : 0;
        const validatedLimit = limit > 0 ? limit : 10;
        const paginatedItems = allItems.slice(validatedSkip, validatedSkip + validatedLimit);
        const totalPages = Math.max(Math.ceil(totalItems / validatedLimit), 1);

        return {
          items: paginatedItems,
          totalItems,
          totalPages,
          skip: validatedSkip,
          limit: validatedLimit,
        };
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      throw error;
    }
  }
}