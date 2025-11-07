import { RequestMethod } from '@nestjs/common';

export enum ExcludedApiRoutes {
  HEALTH = 'health',
  ADDRESSES_LOCATE = 'addresses/locate',
  ADMIN_AUTH_LOGIN = 'admin-auth/login',
  ADMIN_AUTH_REFRESH = 'admin-auth/refresh',
  AUTH_GENERATE_OTP = 'auth/generate-otp',
  AUTH_SIGNIN = 'auth/signin',
  AUTH_REFRESH_TOKEN = 'auth/refresh-token',
  AUTH_CREATE_USER = 'auth/create-user',
  AUTH_VERIFY_OTP = 'auth/verify-otp',
  USERS_KIT_19_WEBHOOK = 'users/kit-19/webhook',
  USERS_LEADS = 'users/leads',
}

export const ExcludedApiMethods: Record<ExcludedApiRoutes, RequestMethod> = {
  [ExcludedApiRoutes.HEALTH]: RequestMethod.GET,
  [ExcludedApiRoutes.ADDRESSES_LOCATE]: RequestMethod.GET,
  [ExcludedApiRoutes.ADMIN_AUTH_LOGIN]: RequestMethod.POST,
  [ExcludedApiRoutes.ADMIN_AUTH_REFRESH]: RequestMethod.POST,
  [ExcludedApiRoutes.AUTH_GENERATE_OTP]: RequestMethod.POST,
  [ExcludedApiRoutes.AUTH_SIGNIN]: RequestMethod.POST,
  [ExcludedApiRoutes.AUTH_REFRESH_TOKEN]: RequestMethod.POST,
  [ExcludedApiRoutes.AUTH_CREATE_USER]: RequestMethod.POST,
  [ExcludedApiRoutes.AUTH_VERIFY_OTP]: RequestMethod.POST,
  [ExcludedApiRoutes.USERS_KIT_19_WEBHOOK]: RequestMethod.POST,
  [ExcludedApiRoutes.USERS_LEADS]: RequestMethod.POST,
};
