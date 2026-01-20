import { Injectable, Inject, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AdminUserService } from '../admin-users/admin-user.service';
import { IAdminUser } from '../../common/interfaces/admin-user.interface';
import { CognitoService } from '../cognito/cognito.service';

@Injectable()
export class AdminAuthService {
    constructor(
        private adminUsersService: AdminUserService,
        private cognito: CognitoService,
    ) {
    }

    async validateUser(email: string, password: string) {
        // Since we're using Cognito for authentication, this method delegates to Cognito
        try {
            const user: IAdminUser = await this.adminUsersService.getOneAdminUser({ email });
            if (!user) {
                return null;
            }

            // Validate with Cognito
            const tokens = await this.cognito.signIn(email, password);
            if (tokens) {
                return user;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async generateTokens(user: IAdminUser) {
        const adminUser = await this.adminUsersService.getAdminUserById(user.adminId);

        return { adminUser };
    }

    async refreshAccessToken(userName: string, refresh_token: string) {
        try {
            const admin = await this.adminUsersService.getOneAdminUser({ email: userName });
            const cognitoUsername = admin?.userName || userName;

            const tokens = await this.cognito.refreshToken(cognitoUsername, refresh_token);
            return tokens;
        } catch (error) {
            console.log('Error in refreshAccessToken:', error.message);
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async logout(_accessToken: string) {
        // Token revocation is not supported for Cognito user pools without custom setup.
        return { message: 'Logged out' };
    }
}
