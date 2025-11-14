export interface IAdminUser {
    adminId: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phoneNumber: string;
    role?: string;
    abilities: {
        attributeName: string;
        attributeAccess: string[];
    }[];   // List of pages or actions the admin can access
    refreshToken?: string;
}