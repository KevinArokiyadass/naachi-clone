import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersDocument } from 'src/modules/users/entity/users.entity';

export interface UsersJwtPayload {
    userId: string;
    email: string;
    phoneNumber: string;
    userName: string;
    iat?: number;
    exp?: number;
}

@Injectable()
export class CommonAuthService {
    constructor(private jwtService: JwtService) {}

    generateUsersToken(user: UsersDocument): string {
        const payload: UsersJwtPayload = {
            userId: user.userId,
            email: user.email,
            phoneNumber: user.phoneNumber,
            userName: user.userName,
        };
        return this.jwtService.sign(payload);
    }

    verifyToken(token: string): UsersJwtPayload {
        return this.jwtService.verify(token) as UsersJwtPayload;
    }
    decodeToken(token: string): UsersJwtPayload {
        return this.jwtService.decode(token) as UsersJwtPayload;
    }
}