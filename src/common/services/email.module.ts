import { forwardRef, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
