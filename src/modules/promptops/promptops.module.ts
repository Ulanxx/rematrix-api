import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PromptopsAdminController } from './promptops-admin.controller';
import { PromptopsService } from './promptops.service';

@Module({
  imports: [PrismaModule],
  controllers: [PromptopsAdminController],
  providers: [PromptopsService],
  exports: [PromptopsService],
})
export class PromptopsModule {}
