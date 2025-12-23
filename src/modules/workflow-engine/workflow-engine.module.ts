import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowEngineController } from './workflow-engine.controller';
import { WorkflowWebSocketGateway } from './workflow-websocket.gateway';
import { WsAuthGuard } from './ws-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { TemporalModule } from '../temporal/temporal.module';

@Module({
  imports: [PrismaModule, TemporalModule],
  controllers: [WorkflowEngineController],
  providers: [WorkflowEngineService, WorkflowWebSocketGateway, WsAuthGuard],
  exports: [WorkflowEngineService],
})
export class WorkflowEngineModule {}
