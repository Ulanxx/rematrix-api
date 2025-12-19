import { Injectable } from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';

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
    markdown: string;
  }): Promise<{ workflowId: string; runId: string }> {
    const client = await this.getClient();
    const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'rematrix-video';

    const workflowId = `video-generation-${params.jobId}`;

    const handle = await client.workflow.start('videoGenerationWorkflow', {
      taskQueue,
      workflowId,
      args: [params],
    });

    return { workflowId, runId: handle.firstExecutionRunId };
  }

  async signalApprove(params: { jobId: string; stage: string }): Promise<void> {
    const client = await this.getClient();
    const workflowId = `video-generation-${params.jobId}`;
    const handle = client.workflow.getHandle(workflowId);
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
    await handle.signal('rejectStage', {
      stage: params.stage,
      reason: params.reason,
    });
  }
}
