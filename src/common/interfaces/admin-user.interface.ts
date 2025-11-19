export interface IAdminUser {
    adminId: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phoneNumber: string;
    userName?: string;
    role?: string;
    status?: 'active' | 'inactive';
    isDeleted?: boolean;
}