import { IMetaTag } from '../enums/user.enum';

export interface IAdminUser {
    adminId: string;
    name: string;
    email: string;
    password: string;
    phoneNumber: string;
    userName?: string;
    role?: string;
    status?: 'active' | 'inactive';
    isDeleted?: boolean;
    permissionGroupsId: string[];
    metaTags?: IMetaTag[];
    permissions?: string[];
}