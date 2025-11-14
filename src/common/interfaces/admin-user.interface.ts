export interface IAdminUser {
    adminId: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phoneNumber: string;
    role?: string;
}