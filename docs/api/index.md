# API 接口概览

Rematrix Server 提供了一套完整的 API，支持视频生成任务的全生命周期管理，包括 RESTful API 和实时 WebSocket 接口。

## 📡 接口列表

| 接口 | 描述 | 功能 |
|------|------|------|
| [Jobs API](./jobs.md) | 任务管理 | 创建、查询、运行、审批任务 |
| [Artifacts API](./artifacts.md) | 产物管理 | 查询、等待、下载各阶段产物 |
| [Workflow Engine API](./workflow-engine.md) | 工作流控制 | 指令解析、执行、状态管理 |
| [WebSocket API](./websocket.md) | 实时推送 | 工作流状态、阶段完成、错误通知 |
| [Chat SSE API](./chat-sse.md) | 实时通信 | AI 对话、状态推送、审批交互 |

## 🔗 基础信息

- **Base URL**: `http://localhost:3000`
- **Content-Type**: `application/json`
- **认证方式**: 暂无（开发阶段）

## 🚀 快速体验

### RESTful API 示例

```bash
# 1. 创建任务
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"config":{"markdown":"# 测试文档\n\n这是一个测试。"}}'

# 2. 启动工作流
curl -X POST http://localhost:3000/jobs/{jobId}/run

# 3. 查询状态
curl http://localhost:3000/jobs/{jobId}

# 4. 建立实时连接（SSE）
curl "http://localhost:3000/jobs/{jobId}/chat/sse?message=任务进展如何？"
```

### WebSocket 实时推送示例

```javascript
// 建立 WebSocket 连接
const ws = new WebSocket('ws://localhost:3000/ws?token=demo-token');

ws.onopen = () => {
  // 加入 Job 房间
  ws.send(JSON.stringify({
    type: 'join_job',
    jobId: 'job-123'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'job_status':
      console.log('状态更新:', data.data.status);
      break;
    case 'stage_completed':
      console.log('阶段完成:', data.data.stage);
      break;
    case 'job_error':
      console.error('错误:', data.data.error);
      break;
  }
};
```

### React Hook 集成

```typescript
import { useWebSocket } from '@/lib/hooks/useWebSocket';

function JobComponent({ jobId }) {
  const { connectionStatus } = useWebSocket({
    jobId,
    onJobStatusUpdate: (data) => {
      console.log('实时状态更新:', data.status);
    },
    onStageCompleted: (data) => {
      console.log('阶段完成:', data.stage);
    },
  });

  return (
    <div>
      <div>连接状态: {connectionStatus}</div>
      {/* 其他 UI 组件 */}
    </div>
  );
}
```

## 📊 状态码说明

| 状态码 | 说明 | 示例场景 |
|--------|------|----------|
| 200 | 成功 | 获取任务信息、查询产物 |
| 201 | 创建成功 | 创建新任务 |
| 400 | 请求错误 | 参数验证失败、无效指令 |
| 404 | 资源不存在 | 任务ID不存在 |
| 409 | 状态冲突 | 任务状态不允许当前操作 |
| 500 | 服务器错误 | 内部异常、数据库错误 |

## 🔄 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    // 具体数据内容
  },
  "timestamp": "2025-12-21T10:00:00Z"
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": {
      "field": "markdown",
      "reason": "内容不能为空"
    }
  },
  "timestamp": "2025-12-21T10:00:00Z"
}
```

## 🛡️ 错误处理

### 常见错误类型

| 错误类型 | 说明 | 解决方案 |
|----------|------|----------|
| `ValidationError` | 参数验证失败 | 检查请求参数格式和必填字段 |
| `NotFoundError` | 资源不存在 | 确认任务ID或资源ID正确 |
| `StateError` | 状态冲突 | 检查任务当前状态是否允许操作 |
| `TemporalError` | 工作流错误 | 查看 Temporal UI 获取详细错误信息 |
| `AIError` | AI 服务错误 | 检查 API Key 和网络连接 |

### 重试策略

```typescript
// 推荐的重试实现
async function retryRequest(url: string, options: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok) {
        return response;
      }
      
      // 4xx 错误不重试
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
      
      // 5xx 错误重试
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }
      
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // 指数退避
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## 📈 性能优化

### 1. 批量操作
```typescript
// 批量查询任务状态
const jobIds = ['job_1', 'job_2', 'job_3'];
const jobs = await Promise.all(
  jobIds.map(id => fetch(`/jobs/${id}`).then(r => r.json()))
);
```

### 2. 条件查询
```typescript
// 只查询必要字段
const response = await fetch('/jobs?fields=id,status,currentStage');
const { jobs } = await response.json();
```

### 3. 分页查询
```typescript
// 分页获取任务列表
const response = await fetch('/jobs?page=1&limit=20');
const { jobs, pagination } = await response.json();
```

## 🔍 监控和调试

### 请求追踪
```typescript
// 添加请求ID便于追踪
const response = await fetch('/jobs', {
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': generateUUID(),
    'X-Client-Version': '1.0.0'
  }
});
```

### 日志记录
```typescript
// 记录API调用日志
console.log('API Call:', {
  method: 'POST',
  url: '/jobs',
  requestId: 'req_123',
  timestamp: new Date().toISOString(),
  duration: 150
});
```

## 📚 更多资源

- [Temporal UI](http://localhost:8233) - 工作流监控
- [API 测试集合](./postman-collection.json) - Postman 导入文件
- [SDK 示例](./sdk-examples/) - 各语言 SDK 使用示例
- [错误码参考](./error-codes.md) - 完整错误码列表

---

📖 **下一步**: 选择具体的 API 模块查看详细文档
