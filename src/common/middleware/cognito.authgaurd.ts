// src/auth/cognito.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import * as jwkToPem from 'jwk-to-pem';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private jwks: any = null;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Invalid token');

    try {
      // fetch and cache jwks
      if (!this.jwks) {
        const jwksUri = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
        const res = await axios.get(jwksUri);
        this.jwks = res.data.keys;
      }

      const decodedHeader: any = jwt.decode(token, { complete: true });
      if (!decodedHeader) throw new UnauthorizedException('Cannot decode token');

      const kid = decodedHeader.header.kid;
      const jwk = this.jwks.find((key) => key.kid === kid);
      if (!jwk) throw new UnauthorizedException('Invalid token kid');

      const pubKey = jwkToPem(jwk);

      const payload = jwt.verify(token, pubKey, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
        audience: process.env.COGNITO_CLIENT_ID,
      });

      request.user = payload; // attach user
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
