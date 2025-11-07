// src/middleware/cognito.middleware.ts
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';

@Injectable()
export class CognitoMiddleware implements NestMiddleware {
  private jwks: any = null;

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) throw new UnauthorizedException('Missing Authorization header');

      const token = authHeader.replace('Bearer ', '');
      if (!token) throw new UnauthorizedException('Invalid token');

      // Fetch JWKS (cached after first call)
      if (!this.jwks) {
        const jwksUri = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
        const res = await axios.get(jwksUri);
        this.jwks = res.data.keys;
      }

      // Decode header to find matching kid
      const decodedHeader: any = jwt.decode(token, { complete: true });
      if (!decodedHeader) throw new UnauthorizedException('Cannot decode token');

      const kid = decodedHeader.header.kid;
      const jwk = this.jwks.find((key) => key.kid === kid);
      if (!jwk) throw new UnauthorizedException('Invalid token kid');

      // Convert JWK to PEM
      const pubKey = this.jwkToPem(jwk);

      // Verify JWT
      const payload = jwt.verify(token, pubKey, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
        audience: process.env.COGNITO_CLIENT_ID,
      });

      // Attach user to request
      (req as any).user = payload;
      next();
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private jwkToPem(jwk: any): string {
    const { n, e } = jwk;
    const pubKey = {
      kty: 'RSA',
      n: Buffer.from(n, 'base64').toString('base64'),
      e: Buffer.from(e, 'base64').toString('base64'),
    };

    // Use `node-jose` or `jwk-to-pem` npm package for cleaner conversion
    const jwkToPem = require('jwk-to-pem');
    return jwkToPem(jwk);
  }
}
