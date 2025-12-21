# Workflow Engine API

工作流引擎接口，提供指令解析、执行和历史查询功能，支持对视频生成工作流的精细化控制。

## 概述

Workflow Engine API 允许通过自然语言或结构化指令来控制和操作视频生成工作流。支持跳过阶段、重试失败步骤、修改参数等高级操作。

## 基础信息

- **Base URL**: `http://localhost:3000/workflow-engine`
- **Content-Type**: `application/json`
- **支持格式**: 指令格式和自然语言格式

---

## 接口详情

### 1. 执行工作流指令

执行指定的工作流控制指令。

```http
POST /workflow-engine/execute
```

**请求体**:
```json
{
  "jobId": "job_123456789",
  "command": "skip_stage",
  "params": {
    "stage": "OUTLINE",
    "reason": "大纲已经足够详细"
  }
}
```

**指令类型**:

| 指令 | 参数 | 说明 |
|------|------|------|
| `skip_stage` | `stage`, `reason` | 跳过指定阶段 |
| `retry_stage` | `stage`, `params` | 重试失败的阶段 |
| `modify_params` | `stage`, `params` | 修改阶段参数 |
| `pause_workflow` | `reason` | 暂停工作流 |
| `resume_workflow` | - | 恢复工作流 |
| `get_status` | - | 获取当前状态 |

**响应示例**:
```json
{
  "success": true,
  "result": {
    "message": "已跳过 OUTLINE 阶段，继续执行 STORYBOARD",
    "executedAt": "2025-12-21T10:30:00Z",
    "affectedStages": ["OUTLINE", "STORYBOARD"],
    "newStatus": "RUNNING"
  }
}
```

---

### 2. 解析指令文本

将文本解析为可执行的工作流指令。

```http
POST /workflow-engine/parse
```

**请求体**:
```json
{
  "message": "跳过大纲阶段，直接进入分镜制作"
}
```

**响应示例**:

**指令格式解析**:
```json
{
  "type": "command",
  "command": "skip_stage",
  "params": {
    "stage": "OUTLINE",
    "reason": "用户指令跳过"
  },
  "confidence": 0.95
}
```

**自然语言解析**:
```json
{
  "type": "natural",
  "command": "skip_stage",
  "params": {
    "stage": "OUTLINE",
    "reason": "直接进入分镜制作"
  },
  "confidence": 0.87
}
```

**无法解析**:
```json
{
  "type": "unknown",
  "message": "Unable to parse command",
  "suggestions": [
    "跳过 [阶段名称]",
    "重试 [阶段名称]",
    "暂停工作流"
  ]
}
```

---

### 3. 查询指令历史

获取指定任务的指令执行历史。

```http
GET /workflow-engine/commands/{jobId}
```

**路径参数**:
- `jobId` (string): 任务 ID

**响应示例**:
```json
{
  "commands": [
    {
      "id": "cmd_001",
      "jobId": "job_123456789",
      "command": "skip_stage",
      "params": {
        "stage": "OUTLINE",
        "reason": "大纲已经足够详细"
      },
      "status": "completed",
      "result": {
        "message": "已跳过 OUTLINE 阶段",
        "executedAt": "2025-12-21T10:30:00Z"
      },
      "createdAt": "2025-12-21T10:29:00Z"
    },
    {
      "id": "cmd_002",
      "jobId": "job_123456789",
      "command": "retry_stage",
      "params": {
        "stage": "NARRATION",
        "params": {
          "temperature": 0.1,
          "maxTokens": 2000
        }
      },
      "status": "failed",
      "error": "工作流不在可重试状态",
      "createdAt": "2025-12-21T10:35:00Z"
    }
  ],
  "totalCount": 2
}
```

---

## 代码逻辑详解

### 指令解析引擎

```typescript
// WorkflowEngineService.parseCommand()
parseCommand(message: string) {
  // 1. 匹配指令格式: 指令名 参数1=值1 参数2=值2
  const commandPattern = /^(\w+)\s+(.+)$/;
  const match = message.trim().match(commandPattern);
  
  if (!match) return null;
  
  const [, command, paramString] = match;
  
  // 2. 解析参数
  const params = this.parseCommandParams(paramString);
  
  // 3. 验证指令和参数
  if (!this.isValidCommand(command, params)) {
    return null;
  }
  
  return {
    command,
    params,
    confidence: 1.0 // 指令格式置信度高
  };
}

// 参数解析
private parseCommandParams(paramString: string) {
  const params: Record<string, any> = {};
  const pairs = paramString.split(/\s+/);
  
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      params[key] = valueParts.join('=');
    } else if (key) {
      // 位置参数，如 stage 名称
      params.stage = key;
    }
  }
  
  return params;
}
```

### 自然语言解析

```typescript
// WorkflowEngineService.parseNaturalLanguage()
parseNaturalLanguage(message: string) {
  // 1. 关键词匹配
  const keywords = {
    skip: ['跳过', '跳过', 'skip', 'bypass'],
    retry: ['重试', '重新', 'retry', 'redo'],
    pause: ['暂停', '停止', 'pause', 'stop'],
    resume: ['继续', '恢复', 'resume', 'continue'],
    modify: ['修改', '调整', 'modify', 'adjust']
  };
  
  // 2. 阶段名称映射
  const stageMapping = {
    '计划': 'PLAN',
    '大纲': 'OUTLINE', 
    '分镜': 'STORYBOARD',
    '口播': 'NARRATION',
    '页面': 'PAGES',
    '渲染': 'RENDER',
    '合并': 'MERGE'
  };
  
  // 3. 意图识别
  const intent = this.detectIntent(message, keywords);
  if (!intent) return null;
  
  // 4. 提取参数
  const stage = this.extractStage(message, stageMapping);
  const reason = this.extractReason(message);
  
  return {
    command: intent.command,
    params: {
      stage,
      reason,
      ...intent.params
    },
    confidence: intent.confidence
  };
}
```

### 指令执行引擎

```typescript
// WorkflowEngineService.executeCommand()
async executeCommand(request: WorkflowCommandRequest) {
  const { jobId, command, params } = request;
  
  // 1. 验证任务状态
  const job = await this.jobsService.get(jobId);
  if (!job) {
    throw new Error('任务不存在');
  }
  
  // 2. 检查指令执行条件
  this.validateExecutionConditions(job, command, params);
  
  // 3. 执行具体指令
  let result: any;
  
  switch (command) {
    case 'skip_stage':
      result = await this.skipStage(jobId, params.stage, params.reason);
      break;
      
    case 'retry_stage':
      result = await this.retryStage(jobId, params.stage, params.params);
      break;
      
    case 'modify_params':
      result = await this.modifyStageParams(jobId, params.stage, params.params);
      break;
      
    case 'pause_workflow':
      result = await this.pauseWorkflow(jobId, params.reason);
      break;
      
    case 'resume_workflow':
      result = await this.resumeWorkflow(jobId);
      break;
      
    case 'get_status':
      result = await this.getWorkflowStatus(jobId);
      break;
      
    default:
      throw new Error(`未知指令: ${command}`);
  }
  
  // 4. 记录指令历史
  await this.recordCommandHistory(jobId, command, params, result);
  
  return result;
}
```

### 阶段跳过逻辑

```typescript
// WorkflowEngineService.skipStage()
private async skipStage(jobId: string, stage: string, reason?: string) {
  // 1. 检查当前工作流状态
  const workflowStatus = await this.getWorkflowStatus(jobId);
  
  if (workflowStatus.currentStage === stage) {
    // 2a. 当前正在执行该阶段，发送跳过信号
    await this.temporalClient.signalWorkflow({
      workflowId: `video-generation-${jobId}`,
      signalName: 'skipStage',
      args: [{ stage, reason }]
    });
  } else if (workflowStatus.completedStages.includes(stage)) {
    // 2b. 阶段已完成，无法跳过
    throw new Error(`阶段 ${stage} 已完成，无法跳过`);
  } else {
    // 2c. 阶段未开始，设置跳过标记
    await this.setStageSkipped(jobId, stage, reason);
  }
  
  return {
    message: `已跳过 ${stage} 阶段${reason ? `，原因: ${reason}` : ''}`,
    executedAt: new Date().toISOString(),
    affectedStages: [stage, this.getNextStage(stage)]
  };
}
```

### 阶段重试逻辑

```typescript
// WorkflowEngineService.retryStage()
private async retryStage(jobId: string, stage: string, newParams?: any) {
  // 1. 检查阶段是否可重试
  const stageStatus = await this.getStageStatus(jobId, stage);
  
  if (stageStatus.status !== 'FAILED') {
    throw new Error(`阶段 ${stage} 不是失败状态，无法重试`);
  }
  
  // 2. 更新阶段参数（如果提供）
  if (newParams) {
    await this.updateStageParams(jobId, stage, newParams);
  }
  
  // 3. 重置阶段状态
  await this.resetStageStatus(jobId, stage);
  
  // 4. 发送重试信号到工作流
  await this.temporalClient.signalWorkflow({
    workflowId: `video-generation-${jobId}`,
    signalName: 'retryStage',
    args: [{ stage, params: newParams }]
  });
  
  return {
    message: `已重新开始执行 ${stage} 阶段`,
    executedAt: new Date().toISOString(),
    newParams: newParams || null
  };
}
```

---

## 使用示例

### 前端指令输入组件

```typescript
// 指令输入组件
const CommandInput = ({ jobId }: { jobId: string }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleExecute = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    try {
      // 1. 先解析指令
      const parseResponse = await fetch('/workflow-engine/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });
      
      const parseResult = await parseResponse.json();
      
      if (parseResult.type === 'unknown') {
        setResult({ error: '无法识别的指令，请重新输入' });
        return;
      }
      
      // 2. 确认执行
      const confirmed = window.confirm(
        `确认执行指令: ${parseResult.command}？\n参数: ${JSON.stringify(parseResult.params, null, 2)}`
      );
      
      if (!confirmed) return;
      
      // 3. 执行指令
      const executeResponse = await fetch('/workflow-engine/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          command: parseResult.command,
          params: parseResult.params
        })
      });
      
      const executeResult = await executeResponse.json();
      setResult(executeResult);
      
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="command-input">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入指令，如: 跳过大纲阶段 或 skip_stage stage=OUTLINE"
        onKeyPress={(e) => e.key === 'Enter' && handleExecute()}
      />
      <button onClick={handleExecute} disabled={loading}>
        {loading ? '执行中...' : '执行'}
      </button>
      
      {result && (
        <div className="result">
          {result.error ? (
            <div className="error">{result.error}</div>
          ) : (
            <div className="success">
              <div>{result.result.message}</div>
              <small>执行时间: {result.result.executedAt}</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### 常用指令示例

```typescript
// 常用指令集合
const commonCommands = [
  {
    description: "跳过大纲阶段",
    natural: "跳过大纲阶段",
    command: "skip_stage stage=OUTLINE"
  },
  {
    description: "重试失败的口播稿生成",
    natural: "重试口播稿",
    command: "retry_stage stage=NARRATION"
  },
  {
    description: "修改渲染参数",
    natural: "修改渲染参数，降低质量",
    command: "modify_params stage=RENDER quality=medium"
  },
  {
    description: "暂停工作流",
    natural: "暂停工作流",
    command: "pause_workflow reason=用户请求暂停"
  },
  {
    description: "恢复工作流",
    natural: "继续执行",
    command: "resume_workflow"
  }
];

// 快捷指令按钮
const QuickCommands = ({ jobId, onExecute }: { jobId: string, onExecute: (cmd: string) => void }) => {
  return (
    <div className="quick-commands">
      <h4>快捷指令</h4>
      {commonCommands.map((cmd, index) => (
        <div key={index} className="command-item">
          <div className="description">{cmd.description}</div>
          <button onClick={() => onExecute(cmd.natural)}>
            自然语言
          </button>
          <button onClick={() => onExecute(cmd.command)}>
            指令格式
          </button>
        </div>
      ))}
    </div>
  );
};
```

---

## 错误处理

### 常见错误类型

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| `INVALID_COMMAND` | 无效的指令名称 | 检查指令拼写和参数 |
| `INVALID_STAGE` | 无效的阶段名称 | 使用正确的阶段名称 |
| `WRONG_STATUS` | 任务状态不允许执行该指令 | 检查任务当前状态 |
| `WORKFLOW_NOT_FOUND` | 工作流不存在 | 检查 Job ID 是否正确 |
| `EXECUTION_FAILED` | 指令执行失败 | 查看详细错误信息 |

### 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "WRONG_STATUS",
    "message": "任务当前状态不允许跳过阶段",
    "details": {
      "currentStatus": "COMPLETED",
      "requiredStatus": ["RUNNING", "WAITING_APPROVAL"]
    }
  }
}
```

---

## 安全考虑

### 权限控制

1. **指令白名单**: 只允许执行预定义的安全指令
2. **参数验证**: 严格验证所有输入参数
3. **状态检查**: 执行前检查任务和工作流状态
4. **审计日志**: 记录所有指令执行历史

### 防护措施

```typescript
// 指令安全检查
private validateCommandSecurity(command: string, params: any) {
  // 1. 检查指令是否在白名单中
  const allowedCommands = [
    'skip_stage', 'retry_stage', 'modify_params',
    'pause_workflow', 'resume_workflow', 'get_status'
  ];
  
  if (!allowedCommands.includes(command)) {
    throw new Error(`不允许的指令: ${command}`);
  }
  
  // 2. 检查参数安全性
  if (params.stage && !this.isValidStage(params.stage)) {
    throw new Error(`无效的阶段: ${params.stage}`);
  }
  
  // 3. 检查参数长度和内容
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 1000) {
      throw new Error(`参数 ${key} 过长`);
    }
  }
}
```

---

*相关文档*: [Jobs API](./jobs.md) | [Chat SSE API](./chat-sse.md) | [Temporal 工作流](../architecture/temporal.md)
