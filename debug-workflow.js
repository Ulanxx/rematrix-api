#!/usr/bin/env node

import { TemporalWorkflowDebugger } from './src/temporal/utils/temporal-debugger.js';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
🔍 Temporal Workflow 调试工具

用法:
  node debug-workflow.js <workflow-id> <command> [options]

命令:
  status      - 查询 workflow 状态
  details     - 获取详细信息
  history     - 查看历史事件
  approve     - 批准阶段
  reject      - 拒绝阶段
  monitor     - 实时监控

示例:
  node debug-workflow.js wf-123 status
  node debug-workflow.js wf-123 approve PLAN
  node debug-workflow.js wf-123 reject PLAN "需要修改"
  node debug-workflow.js wf-123 monitor
`);
  process.exit(1);
}

const [workflowId, command, ...options] = args;

async function main() {
  const workflowDebugger = new TemporalWorkflowDebugger();
  
  try {
    switch (command) {
      case 'status':
        await workflowDebugger.queryWorkflowStatus(workflowId);
        break;
        
      case 'details':
        await workflowDebugger.getWorkflowDetails(workflowId);
        break;
        
      case 'history':
        const limit = parseInt(options[0]) || 50;
        await workflowDebugger.getWorkflowHistory(workflowId, limit);
        break;
        
      case 'approve':
        if (!options[0]) {
          console.error('❌ 请指定要批准的阶段');
          process.exit(1);
        }
        await workflowDebugger.approveStage(workflowId, options[0]);
        console.log(`✅ 已批准阶段: ${options[0]}`);
        break;
        
      case 'reject':
        if (!options[0]) {
          console.error('❌ 请指定要拒绝的阶段');
          process.exit(1);
        }
        const reason = options[1];
        await workflowDebugger.rejectStage(workflowId, options[0], reason);
        console.log(`❌ 已拒绝阶段: ${options[0]}${reason ? ` (原因: ${reason})` : ''}`);
        break;
        
      case 'monitor':
        const interval = parseInt(options[0]) || 5000;
        console.log(`👀 开始监控 workflow: ${workflowId} (间隔: ${interval}ms)`);
        await workflowDebugger.monitorWorkflow(workflowId, interval);
        break;
        
      default:
        console.error(`❌ 未知命令: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ 执行失败: ${error.message}`);
    process.exit(1);
  } finally {
    await workflowDebugger.close();
  }
}

main().catch(console.error);
