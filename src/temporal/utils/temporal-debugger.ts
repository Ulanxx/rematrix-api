import { Connection } from '@temporalio/client';
import { WorkflowClient } from '@temporalio/client';

/**
 * Temporal Workflow 调试工具
 */
export class TemporalWorkflowDebugger {
  private connection: Connection;
  private client: WorkflowClient;

  constructor(address: string = 'localhost:7233') {
    // 使用异步方式创建连接
    this.connection = Connection.connect({ address }) as any;
    this.client = new WorkflowClient({ connection: this.connection });
  }

  /**
   * 获取 workflow 详细信息
   */
  async getWorkflowDetails(workflowId: string) {
    const workflow = this.client.getHandle(workflowId);

    try {
      // 获取 workflow 状态
      const describe = await workflow.describe();

      console.log(`📋 Workflow: ${workflowId}`);
      console.log(`Status: ${JSON.stringify(describe.status)}`);
      console.log(
        `Workflow Type: ${(describe as any).workflowType?.name || 'Unknown'}`,
      );
      console.log(
        `Start Time: ${(describe as any).startTime?.toISOString() || 'Unknown'}`,
      );
      console.log(
        `Execution Time: ${(describe as any).executionTime?.toISOString() || 'Unknown'}`,
      );

      return describe;
    } catch (error) {
      console.error(`❌ 获取 workflow 信息失败: ${error}`);
      throw error;
    }
  }

  /**
   * 查询 workflow 状态
   */
  async queryWorkflowStatus(workflowId: string) {
    const workflow = this.client.getHandle(workflowId);

    try {
      // 查询当前状态
      const status = await workflow.query('getStatus');
      console.log(`🔍 Workflow Status:`, status);

      return status;
    } catch (error) {
      console.error(`❌ 查询 workflow 状态失败: ${error}`);
      return null;
    }
  }

  /**
   * 发送信号到 workflow
   */
  async sendSignal(workflowId: string, signalName: string, signalData: any) {
    const workflow = this.client.getHandle(workflowId);

    try {
      await workflow.signal(signalName, signalData);
      console.log(`✅ 发送信号 ${signalName} 到 workflow ${workflowId}`);
    } catch (error) {
      console.error(`❌ 发送信号失败: ${error}`);
      throw error;
    }
  }

  /**
   * 批量发送批准信号
   */
  async approveStage(workflowId: string, stage: string) {
    await this.sendSignal(workflowId, 'approveStage', { stage });
  }

  /**
   * 批量发送拒绝信号
   */
  async rejectStage(workflowId: string, stage: string, reason?: string) {
    await this.sendSignal(workflowId, 'rejectStage', { stage, reason });
  }

  /**
   * 获取 workflow 历史事件
   */
  async getWorkflowHistory(
    workflowId: string,
    limit: number = 50,
  ): Promise<any[]> {
    const workflow = this.client.getHandle(workflowId);

    try {
      const history = await workflow.fetchHistory();
      console.log(`📜 Workflow History (最近 ${limit} 个事件):`);

      const events = history.events?.slice(-limit) || [];
      events.forEach((event, index) => {
        console.log(
          `${index + 1}. ${event.eventType}: ${JSON.stringify(event)}`,
        );
      });

      return events;
    } catch (error) {
      console.error(`❌ 获取 workflow 历史失败: ${error}`);
      return [];
    }
  }

  /**
   * 实时监控 workflow
   */
  monitorWorkflow(workflowId: string, interval: number = 5000) {
    console.log(`👀 开始监控 workflow: ${workflowId}`);

    const monitor = setInterval(() => {
      this.queryWorkflowStatus(workflowId)
        .then((status) => {
          if (status && (status as any).status === 'COMPLETED') {
            console.log('✅ Workflow 已完成');
            clearInterval(monitor);
          }
        })
        .catch((error) => {
          console.error('监控出错:', error);
        });
    }, interval);

    return monitor;
  }

  /**
   * 关闭连接
   */
  async close() {
    await this.connection.close();
  }
}

// 使用示例
export async function debugVideoGenerationWorkflow(workflowId: string) {
  const workflowDebugger = new TemporalWorkflowDebugger();

  try {
    // 获取详细信息
    await workflowDebugger.getWorkflowDetails(workflowId);

    // 查询状态
    await workflowDebugger.queryWorkflowStatus(workflowId);

    // 获取历史
    await workflowDebugger.getWorkflowHistory(workflowId);

    // 示例：批准 PLAN 阶段
    // await workflowDebugger.approveStage(workflowId, 'PLAN');
  } finally {
    await workflowDebugger.close();
  }
}
