---
title: WebSocket API
description: 实时工作流状态推送 WebSocket 接口文档
---

# WebSocket API

WebSocket API 提供实时的工作流状态推送，替代传统的轮询机制，实现更高效的状态更新。

## 🚀 概述

WebSocket API 允许客户端建立持久连接，实时接收工作流状态变化、阶段完成和错误通知。

### 主要优势

- **实时性**: 毫秒级状态更新，无需轮询
- **高效性**: 减少网络请求，降低服务器负载
- **可靠性**: 自动重连机制，确保连接稳定性
- **类型安全**: 完整的 TypeScript 类型定义

## 🔌 连接端点

### 基础连接

```typescript
const ws = new WebSocket('ws://localhost:3000/ws?token=demo-token');
```

### 连接参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `token` | string | ✅ | 认证令牌，支持 `demo-token` 或环境变量 `WS_AUTH_TOKEN` |

## 📡 消息协议

### 客户端消息

#### 加入 Job 房间

```json
{
  "type": "join_job",
  "jobId": "job-123"
}
```

#### 离开 Job 房间

```json
{
  "type": "leave_job", 
  "jobId": "job-123"
}
```

#### 心跳检测

```json
{
  "type": "ping"
}
```

### 服务器消息

#### 连接建立确认

```json
{
  "type": "connection_established",
  "clientId": "client-456",
  "timestamp": "2025-12-22T08:46:27.500Z",
  "heartbeatInterval": 30000
}
```

#### Job 状态更新

```json
{
  "type": "job_status",
  "data": {
    "jobId": "job-123",
    "status": "RUNNING",
    "currentStage": "OUTLINE",
    "completedStages": ["PLAN"],
    "timestamp": "2025-12-22T08:46:30.000Z"
  }
}
```

#### 阶段完成通知

```json
{
  "type": "stage_completed",
  "data": {
    "jobId": "job-123",
    "stage": "OUTLINE",
    "nextStage": "STORYBOARD",
    "timestamp": "2025-12-22T08:46:35.000Z"
  }
}
```

#### 错误通知

```json
{
  "type": "job_error",
  "data": {
    "jobId": "job-123",
    "error": "Stage execution failed",
    "stage": "STORYBOARD",
    "timestamp": "2025-12-22T08:46:40.000Z"
  }
}
```

#### 错误响应

```json
{
  "type": "error",
  "message": "Authentication failed",
  "code": "UNAUTHORIZED",
  "timestamp": "2025-12-22T08:46:27.500Z"
}
```

## 🛠️ 客户端集成

### React Hook

使用提供的 `useWebSocket` Hook 进行集成：

```typescript
import { useWebSocket } from '@/lib/hooks/useWebSocket';

const {
  connectionStatus,
  reconnectAttempts,
  connect,
  disconnect,
} = useWebSocket({
  jobId: 'job-123',
  onJobStatusUpdate: (data) => {
    console.log('Job status updated:', data.status);
  },
  onStageCompleted: (data) => {
    console.log('Stage completed:', data.stage);
  },
  onJobError: (data) => {
    console.error('Job error:', data.error);
  },
  onConnectionChange: (connected) => {
    console.log('Connection status:', connected);
  },
  onError: (error) => {
    console.error('WebSocket error:', error);
  },
});
```

### 原生 JavaScript

```javascript
class WebSocketClient {
  constructor(jobId, token = 'demo-token') {
    this.jobId = jobId;
    this.token = token;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
  }

  connect() {
    const url = `ws://localhost:3000/ws?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.joinJobRoom();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code);
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  joinJobRoom() {
    this.send({
      type: 'join_job',
      jobId: this.jobId
    });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case 'connection_established':
        console.log('Connection established');
        break;
      case 'job_status':
        console.log('Job status:', data.data);
        break;
      case 'stage_completed':
        console.log('Stage completed:', data.data);
        break;
      case 'job_error':
        console.error('Job error:', data.data);
        break;
      default:
        console.log('Unknown message:', data);
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 使用示例
const client = new WebSocketClient('job-123');
client.connect();
```

## 🔧 配置选项

### 环境变量

| 变量名 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `WS_AUTH_TOKEN` | string | - | WebSocket 认证令牌 |

### 连接配置

| 配置项 | 默认值 | 描述 |
|--------|--------|------|
| 心跳间隔 | 30000ms | 客户端心跳检测间隔 |
| 连接超时 | 60000ms | 连接超时时间 |
| 重连间隔 | 3000ms | 自动重连间隔 |
| 最大重连次数 | 5 | 最大重连尝试次数 |

## 📊 状态码

### WebSocket 关闭代码

| 代码 | 描述 |
|------|------|
| 1000 | 正常关闭 |
| 1008 | 认证失败 |
| 1006 | 连接异常关闭 |

### 连接状态

| 状态 | 描述 |
|------|------|
| `connecting` | 连接中 |
| `connected` | 已连接 |
| `disconnected` | 已断开 |
| `error` | 连接错误 |

## 🧪 测试

### 测试脚本

```bash
# 运行 WebSocket 测试
node websocket-test.js
```

### 测试页面

访问 `http://localhost:5173/websocket-test` 进行交互式测试。

### 手动测试

```javascript
// 简单连接测试
const ws = new WebSocket('ws://localhost:3000/ws?token=demo-token');

ws.onopen = () => {
  console.log('Connected!');
  ws.send(JSON.stringify({
    type: 'join_job',
    jobId: 'test-job-123'
  }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

## 🔍 故障排查

### 常见问题

**连接失败**
- 检查 token 是否正确
- 确认服务器正在运行
- 验证 WebSocket 端点是否可访问

**认证失败**
- 确认使用正确的 token
- 检查环境变量 `WS_AUTH_TOKEN` 设置

**连接断开**
- 检查网络连接
- 查看服务器日志
- 确认心跳机制正常工作

### 调试技巧

1. **启用调试日志**:
   ```typescript
   // 在浏览器控制台启用详细日志
   localStorage.setItem('ws-debug', 'true');
   ```

2. **监控网络**:
   - 使用浏览器开发者工具监控 WebSocket 连接
   - 检查 Frames 标签页查看消息流

3. **服务器日志**:
   ```bash
   # 查看服务器 WebSocket 日志
   pnpm start:dev | grep WebSocket
   ```

## 🚀 性能优化

### 客户端优化

- **连接池**: 复用 WebSocket 连接
- **消息缓冲**: 批量处理非关键消息
- **内存管理**: 及时清理事件监听器

### 服务器优化

- **房间管理**: 基于 jobId 的高效分组
- **消息压缩**: 大消息启用压缩
- **连接限制**: 防止连接数过多

## 📝 更新日志

### v1.0.0 (2025-12-22)
- ✅ 初始 WebSocket API 实现
- ✅ 实时工作流状态推送
- ✅ 自动重连机制
- ✅ 认证和错误处理
- ✅ React Hook 集成
- ✅ 完整的测试套件

---

🎉 **WebSocket API 现已完全替代轮询机制，提供更高效的实时状态更新！**
