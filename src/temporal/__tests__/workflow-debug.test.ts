// 注意：这个文件需要安装 @temporalio/testing 包
// npm install @temporalio/testing

import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { Connection } from '@temporalio/client';
import { WorkflowClient } from '@temporalio/client';
import { videoGenerationWorkflow } from '../workflows/video-generation.workflow';
import * as activities from '../activities/video-generation.activities';

// 调试 Temporal Workflow 的测试示例
async function debugWorkflow() {
  const testEnv = await TestWorkflowEnvironment.createTimeSkipping();

  try {
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-video-generation',
      workflowsPath: require.resolve('../workflows/video-generation.workflow'),
      activities,
    });

    await worker.runUntil(async () => {
      const result = await testEnv.workflowClient.execute(
        videoGenerationWorkflow,
        {
          workflowId: 'test-debug-workflow',
          args: [
            {
              jobId: 'test-job-123',
              config: {
                content: '# Test Content\nThis is a test video generation.',
              },
            },
          ],
          taskQueue: 'test-video-generation',
        },
      );

      console.log('Workflow result:', result);
    });
  } finally {
    await testEnv.teardown();
  }
}

// 查询运行中的 workflow
async function queryWorkflow(workflowId: string) {
  const connection = await Connection.connect({ address: 'localhost:7233' });
  const client = new WorkflowClient({ connection });

  const workflow = client.getHandle(workflowId);

  // 查询 workflow 状态
  const status = await workflow.query('getStatus');
  console.log('Workflow status:', status);
}

// 发送信号到 workflow
async function sendApprovalSignal(workflowId: string, stage: string) {
  const connection = await Connection.connect({ address: 'localhost:7233' });
  const client = new WorkflowClient({ connection });

  const workflow = client.getHandle(workflowId);

  // 发送批准信号
  await workflow.signal('approveStage', { stage });
  console.log(`Sent approval signal for stage: ${stage}`);
}

export { debugWorkflow, queryWorkflow, sendApprovalSignal };
