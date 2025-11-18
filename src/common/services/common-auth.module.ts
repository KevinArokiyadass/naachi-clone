import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CommonAuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-here',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [CommonAuthService],
  exports: [CommonAuthService, JwtModule],
})
export class CommonAuthModule {}
