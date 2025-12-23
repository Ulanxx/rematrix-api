import { Injectable } from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';
import { CreateJobDto } from '../jobs/dto/create-job.dto';

@Injectable()
export class TemporalClientService {
  private connection?: Connection;
  private client?: Client;

  private async getClient(): Promise<Client> {
    if (this.client) return this.client;

    const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
    const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';

    this.connection = await Connection.connect({ address });
    this.client = new Client({ connection: this.connection, namespace });

    return this.client;
  }

  async startVideoGeneration(params: {
    jobId: string;
    config: CreateJobDto;
  }): Promise<{ workflowId: string; runId: string }> {
    const client = await this.getClient();
    const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'rematrix-video';

    const workflowId = `video-generation-${params.jobId}`;

    // 转换为工作流期望的格式
    const workflowInput = {
      jobId: params.jobId,
      config: params.config,
    };

    const handle = await client.workflow.start('videoGenerationWorkflow', {
      taskQueue,
      workflowId,
      args: [workflowInput],
    });

    return { workflowId, runId: handle.firstExecutionRunId };
  }

  async signalApprove(params: { jobId: string; stage: string }): Promise<void> {
    const client = await this.getClient();
    const workflowId = `video-generation-${params.jobId}`;
    const handle = client.workflow.getHandle(workflowId);

    // 检查工作流状态
    const workflowStatus = await handle.describe();
    const status = workflowStatus.status.name; // 访问 name 属性获取字符串状态

    console.log(`[TemporalClient] Workflow ${workflowId} status: ${status}`);

    if (
      status === 'COMPLETED' ||
      status === 'FAILED' ||
      status === 'CANCELLED' ||
      status === 'TERMINATED'
    ) {
      throw new Error(
        `Cannot approve stage: workflow execution is ${status.toLowerCase()}`,
      );
    }

    await handle.signal('approveStage', { stage: params.stage });
  }

  async signalReject(params: {
    jobId: string;
    stage: string;
    reason?: string;
  }): Promise<void> {
    const client = await this.getClient();
    const workflowId = `video-generation-${params.jobId}`;
    const handle = client.workflow.getHandle(workflowId);

    // 检查工作流状态
    const workflowStatus = await handle.describe();
    const status = workflowStatus.status.name; // 访问 name 属性获取字符串状态

    if (
      status === 'COMPLETED' ||
      status === 'FAILED' ||
      status === 'CANCELLED' ||
      status === 'TERMINATED'
    ) {
      throw new Error(
        `Cannot reject stage: workflow execution is ${status.toLowerCase()}`,
      );
    }

    await handle.signal('rejectStage', {
      stage: params.stage,
      reason: params.reason,
    });
  }
}
