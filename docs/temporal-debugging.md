# Temporal Workflow 调试完整指南

## 🎯 调试方法概览

Temporal workflow 无法使用传统断点调试，但有专门的调试方法：

### 1. 📊 实时监控
```bash
# 使用调试脚本
./scripts/debug-temporal.sh
```

### 2. 🌐 Web UI 调试
访问: http://localhost:8233
- 查看所有 workflow 执行历史
- 查看详细的事件时间线
- 查看日志输出
- 发送信号进行交互

### 3. 🔍 代码级调试

#### 使用查询接口
```typescript
import { TemporalDebugger } from './src/temporal/utils/temporal-debugger';

const debugger = new TemporalDebugger();

// 查询 workflow 状态
const status = await debugger.queryWorkflowStatus('workflow-id');
console.log('状态:', status);

// 获取详细信息
const details = await debugger.getWorkflowDetails('workflow-id');

// 批准阶段
await debugger.approveStage('workflow-id', 'PLAN');

// 拒绝阶段
await debugger.rejectStage('workflow-id', 'PLAN', '需要修改');
```

#### 查看历史事件
```typescript
// 获取最近 50 个事件
const history = await debugger.getWorkflowHistory('workflow-id', 50);
```

#### 实时监控
```typescript
// 每 5 秒检查一次状态
const monitor = await debugger.monitorWorkflow('workflow-id', 5000);
```

### 4. 📋 日志分析

您的 workflow 已经包含详细日志：
- ✅ 每个阶段开始/结束
- ✅ 审批状态变化
- ✅ 错误和警告信息
- ✅ 包含 jobId 上下文

### 5. 🧪 测试环境调试

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';

// 在测试环境中调试
const testEnv = await TestWorkflowEnvironment.createTimeSkipping();
// ... 测试代码
```

## 🚀 实际使用示例

### 调试一个卡住的 workflow
```typescript
// 1. 检查状态
const status = await debugger.queryWorkflowStatus('stuck-workflow');

// 2. 查看历史
const history = await debugger.getWorkflowHistory('stuck-workflow');

// 3. 如果等待审批，手动批准
await debugger.approveStage('stuck-workflow', 'PLAN');
```

### 监控 workflow 进度
```bash
# 实时查看日志
docker logs temporal-worker -f

# 在 Web UI 中查看
# http://localhost:8233/workflows
```

## 🔧 常见问题解决

### Workflow 卡在等待审批
- 使用 `approveStage` 信号批准
- 检查信号是否正确发送
- 查看 Web UI 中的事件历史

### Activity 执行失败
- 查看 Worker 日志
- 检查 activity 参数
- 使用 Web UI 查看错误详情

### Workflow 重启问题
- 检查确定性要求
- 确保没有随机性或时间依赖
- 查看重放历史

## 📱 调试工具清单

- ✅ 详细日志记录
- ✅ Web UI 监控
- ✅ 查询接口
- ✅ 信号交互
- ✅ 历史事件查看
- ✅ 实时监控工具
- ✅ 测试环境支持

现在您有了完整的 Temporal workflow 调试能力！
