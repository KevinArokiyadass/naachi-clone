import { HttpStatus } from '@nestjs/common';
import { ErrorDetails } from '../interfaces/error-details.interface';

export const ERROR_CODES: Record<string, ErrorDetails> = {
    SOMETHING_WENT_WRONG: {
        code: '001',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Something went wrong, please try again.',
    },
    PROBLEM_WITH_REQUEST_PAYLOAD_INVALID_STRING: {
        code: '002',
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Problem with the request payload - Invalid String.',
    },
    USER_NOT_FOUND_NAME_REQUIRED: {
        code: '003',
        statusCode: HttpStatus.NOT_FOUND,
        message: 'User does not exist. Name is required for new users.',
    },
    INVALID_SESSION_ID_USER_NOT_FOUND: {
        code: '004',
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid session ID or user not found.',
    },
    OTP_MISMATCH: {
        code: '005',
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'OTP mismatch.',
    },
    OTP_EXPIRED: {
        code: '006',
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'OTP has expired.',
    },
    INVALID_REFRESH_TOKEN: {
        code: '007',
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid refresh token.',
    },
    REFERRAL_CODE_EXISTS: {
        code: '101',
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'You already have a referral code associated with your account. Please use the existing code or try a different one.',
    },
    SUBSCRIPTION_EXISTS: {
        code: '101',
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'You already have an active subscription. Referral codes can only be applied if you don\'t have an active subscription.',
    }
};

export const ERROR_CODE_PREFIX = 'US';