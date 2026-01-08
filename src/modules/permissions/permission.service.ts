import { Injectable, BadRequestException } from '@nestjs/common';
import { RecordService } from '@noukha-technologies/mdm-core';
import { IPaginatedResult } from 'src/common/interfaces/paginated-result.interface';

@Injectable()
export class PermissionService {
  constructor(private readonly recordService: RecordService) {}

  async createPermission(data: any, institutionsId?: string) {
    if (data?.name || data?.code) {
      await this.checkDuplicatePermission({
        name: data.name,
        code: data.code,
      }, institutionsId);
    }
  
    const recordData = { ...data };
    if (institutionsId) {
      recordData.institutionsId = institutionsId;
    }
    // CreateRecordDto expects { data: Record<string, any> }
    try {
    return await this.recordService.createRecord('permissions', { data: recordData });
    } catch (err) {
      // Handles duplicate requests
      if (err?.code === 11000) {
        throw new BadRequestException('Permission name already exists');
      }
      throw err;
    }
  }

  async updatePermission(id: string, data: any, institutionsId?: string) {
    const existingPermission = await this.recordService.findOne(
      'permissions',
      id,
    );
  
    if (!existingPermission) {
      throw new BadRequestException('Permission not found');
    }
  
   
    const incomingName = data.name ?? existingPermission.name;
    const incomingCode = data.code ?? existingPermission.code;
  
   
    if (
      incomingName === existingPermission.name &&
      incomingCode === existingPermission.code
    ) {
      throw new BadRequestException(
        'Permission already exists with same name and code',
      );
    }
    if (data?.name || data?.code) {
      await this.checkDuplicatePermission(
        {
          name: data.name ?? existingPermission.name,
          code: data.code ?? existingPermission.code,
        },
        institutionsId,
        id,
      );
    }
  
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
    
    }; 


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

  private async checkDuplicatePermission(
    data: { name: string; code: string },
    institutionsId?: string,
    excludeId?: string,
  ) {
    const filters: any = {
      isDeleted: { $ne: true },
      $or: [],
    };

    if (data.name) {
      filters.$or.push({ name: data.name });
    }

    if (data.code) {
      filters.$or.push({ code: data.code });
    }

    if (filters.$or.length === 0) {
      return;
    }
    if (institutionsId) {
      filters.institutionsId = institutionsId;
    }
  
    if (excludeId) {
      filters._id = { $ne: excludeId };
    }
  
    const existing = await this.recordService.findAll('permissions', {
      filters,
      nonPaginated: true,
    });
  
    if (existing?.items?.length > 0) {
      const duplicate = existing.items[0];
      if (duplicate.name === data.name) {
        throw new BadRequestException('Permission name already exists');
      }
      if (duplicate.code === data.code) {
        throw new BadRequestException('Permission code already exists');
      }
      throw new BadRequestException('Permission already exists');
    }
  }
  
}