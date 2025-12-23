import { Module, forwardRef } from '@nestjs/common';
import { ChatMessagesModule } from '../chat-messages/chat-messages.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TemporalModule } from '../temporal/temporal.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    PrismaModule,
    TemporalModule,
    ChatMessagesModule,
    forwardRef(() => WorkflowEngineModule),
  ],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
