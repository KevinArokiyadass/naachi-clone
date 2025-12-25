import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateTokenDto {
    @ApiProperty({ description: 'FCM token to validate' })
    @IsString()
    token: string;

    @ApiProperty({ description: 'User ID' })
    @IsString()
    userId: string;
}

export class ValidateTokenResponseDto {
    @ApiProperty({ description: 'Whether the token is valid' })
    isValid: boolean;

    @ApiProperty({ description: 'Error message if token is invalid', required: false })
    error?: string;

    @ApiProperty({ description: 'Whether the token was deactivated', required: false })
    deactivated?: boolean;
}

export class ValidateMultipleTokensResponseDto {
    @ApiProperty({ description: 'List of valid tokens' })
    validTokens: string[];

    @ApiProperty({
        description: 'List of invalid tokens with details',
        type: 'array',
        items: {
            type: 'object',
            properties: {
                token: { type: 'string' },
                error: { type: 'string' },
                deactivated: { type: 'boolean' }
            }
        }
    })
    invalidTokens: Array<{
        token: string;
        error: string;
        deactivated: boolean;
    }>;

    @ApiProperty({
        description: 'Summary of validation results',
        type: 'object',
        properties: {
            total: { type: 'number' },
            valid: { type: 'number' },
            invalid: { type: 'number' },
            deactivated: { type: 'number' }
        }
    })
    summary: {
        total: number;
        valid: number;
        invalid: number;
        deactivated: number;
    };
}
