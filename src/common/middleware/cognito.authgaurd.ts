// src/auth/cognito.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import * as jwkToPem from 'jwk-to-pem';

/**
 * CognitoAuthGuard - JWT Token Authentication Guard
 * 
 * This guard validates Cognito JWT AccessTokens:
 * 1. Extracts token from Authorization header
 * 2. Validates token signature using Cognito JWKS
 * 3. Verifies token issuer and expiration
 * 4. Validates client_id matches expected client
 * 5. Ensures token is AccessToken (not IdToken)
 * 6. Attaches token payload to request.user
 * 
 * Token Payload Structure (AccessToken):
 * {
 *   "sub": "user-uuid",
 *   "username": "minons709",        // ← lowercase (Cognito format)
 *   "token_use": "access",
 *   "client_id": "4oa1ji9fd6ngtmh0cr76o5ba5f",
 *   "scope": "aws.cognito.signin.user.admin",
 *   "exp": 1234567890,
 *   "iat": 1234567890
 * }
 * 
 * Note: Token has 'username' (lowercase), but database stores 'userName' (camelCase)
 * RolesGuard will handle the mapping: token.username → DB.userName
 */
@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private jwks: any = null;

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    // Extract token from Authorization header
    // Handle formats: "Bearer token", "Bearer  token" (extra spaces), or just "token"
    let token = authHeader.toString().trim();
    if (token.toLowerCase().startsWith('bearer ')) {
      token = token.substring(7).trim(); // Remove "Bearer " prefix
    }
    
    // Remove any surrounding quotes that might have been added
    token = token.replace(/^["']|["']$/g, '').trim();
    
    if (!token) {
      throw new UnauthorizedException('Invalid token: Token is empty after extraction');
    }

    // Basic JWT format validation (should have 3 parts separated by dots)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new UnauthorizedException(
        `Invalid token format. Expected JWT format (header.payload.signature), but got ${tokenParts.length} parts. Token length: ${token.length}`
      );
    }

    try {
      // fetch and cache jwks
      if (!this.jwks) {
        const jwksUri = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
        const res = await axios.get(jwksUri);
        this.jwks = res.data.keys;
      }

      const decodedHeader: any = jwt.decode(token, { complete: true });
      if (!decodedHeader || !decodedHeader.header) {
        throw new UnauthorizedException(
          `Cannot decode token. Token may be malformed. First 50 chars: ${token.substring(0, 50)}...`
        );
      }

      const kid = decodedHeader.header.kid;
      const jwk = this.jwks.find((key) => key.kid === kid);
      if (!jwk) throw new UnauthorizedException('Invalid token kid');

      const pubKey = jwkToPem(jwk);


      const expectedClientId = process.env.COGNITO_CLIENT_ID;
      const issuer = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
      
      const payload: any = jwt.verify(token, pubKey, {
        algorithms: ['RS256'],
        issuer: issuer,
        // Explicitly don't check audience - Cognito uses client_id instead
      });

      // Manually validate client_id (Cognito AccessTokens use client_id, not aud)
      if (!payload.client_id) {
        throw new UnauthorizedException(
          'Invalid token: Missing client_id field. This may not be a valid Cognito AccessToken.'
        );
      }

      if (payload.client_id !== expectedClientId) {
        throw new UnauthorizedException(
          `Invalid token client_id. Expected: ${expectedClientId}, but token has: ${payload.client_id}. Please ensure you're using the correct accessToken from the correct Cognito client.`
        );
      }

      // Verify this is an AccessToken (not IdToken)
      // AccessToken has token_use: "access", IdToken has token_use: "id"
      if (payload.token_use !== 'access') {
        throw new UnauthorizedException(
          `Invalid token type. Expected AccessToken (token_use: "access"), but got token_use: "${payload.token_use}". Please use the accessToken from login response.`,
        );
      }

      // Cognito AccessToken payload structure:
      // {
      //   "sub": "user-uuid",
      //   "username": "admin-username",  // This is the primary identifier
      //   "token_use": "access",
      //   "scope": "...",
      //   "client_id": "...",
      //   "exp": 1234567890,
      //   "iat": 1234567890
      // }
      request.user = payload; // attach user payload to request
      return true;
    } catch (err) {
      // Provide more detailed error messages for debugging
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired. Please login again.');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new UnauthorizedException(`Invalid token: ${err.message}`);
      }
      if (err.name === 'UnauthorizedException') {
        throw err; // Re-throw our custom exceptions
      }

      console.error('CognitoAuthGuard error:', err.message, err.name);
      throw new UnauthorizedException(`Token validation failed: ${err.message || 'Invalid or expired token'}`);
    }
  }
}
