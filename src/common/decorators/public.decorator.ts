import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public - bypasses CognitoAuthGuard (and optionally other auth guards).
 * Use only for routes that must be accessible without JWT (e.g. admin-user/create for bootstrap).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
