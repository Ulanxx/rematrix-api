# API 使用指南

本指南详细介绍 Rematrix Server API 的使用方法、最佳实践和常见模式。

## 🔌 API 概览

Rematrix Server 提供 RESTful API，支持视频生成任务的全生命周期管理。

### 核心接口

| 接口类别 | 端点前缀 | 功能描述 |
|----------|----------|----------|
| Jobs API | `/jobs` | 任务创建、查询、控制 |
| Artifacts API | `/jobs/{id}/artifacts` | 产物查询和管理 |
| Workflow Engine API | `/workflow-engine` | 工作流指令执行 |
| Chat SSE API | `/jobs/{id}/chat/sse` | 实时通信和 AI 对话 |

## 📋 基础配置

### 1. 设置请求头

```typescript
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  // 可选：添加认证头
  // 'Authorization': 'Bearer your-token'
};

// 可选：添加请求追踪
headers['X-Request-ID'] = generateUUID();
headers['X-Client-Version'] = '1.0.0';
```

### 2. 错误处理

```typescript
class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

async function apiRequest(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new APIError(
        response.status,
        error.error?.code || 'UNKNOWN_ERROR',
        error.error?.message || '请求失败',
        error.error?.details
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(0, 'NETWORK_ERROR', '网络请求失败');
  }
}
```

## 🚀 Jobs API 使用

### 创建任务

```typescript
interface CreateJobRequest {
  config: {
    markdown: string;
    voiceConfig?: {
      voiceId: string;
      speed: number;
    };
  };
}

async function createJob(markdown: string): Promise<{ jobId: string }> {
  return apiRequest('/jobs', {
    method: 'POST',
    body: JSON.stringify({
      config: {
        markdown: markdown.trim(),
        // 可选参数
        voiceConfig: {
          voiceId: 'zh-CN-XiaoxiaoNeural',
          speed: 1.0
        }
      }
    })
  });
}

// 使用示例
const { jobId } = await createJob(`
# 深度学习入门

## 基础概念
深度学习是机器学习的一个重要分支，它通过模拟人脑神经网络的结构和功能来实现学习。

## 核心技术
- 神经网络
- 反向传播算法
- 梯度下降优化

## 应用领域
深度学习在计算机视觉、自然语言处理、语音识别等领域取得了突破性进展。
`);
```

### 查询任务状态

```typescript
interface Job {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  currentStage: string;
  createdAt: string;
  updatedAt: string;
  config: any;
  metadata?: any;
}

async function getJob(jobId: string): Promise<Job> {
  return apiRequest(`/jobs/${jobId}`);
}

// 轮询任务状态
async function waitForJobCompletion(
  jobId: string,
  timeoutMs = 600000 // 10分钟超时
): Promise<Job> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const job = await getJob(jobId);
    
    if (['COMPLETED', 'FAILED'].includes(job.status)) {
      return job;
    }
    
    // 指数退避
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('任务超时');
}
```

### 控制任务执行

```typescript
// 启动任务
async function runJob(jobId: string): Promise<void> {
  return apiRequest(`/jobs/${jobId}/run`, {
    method: 'POST'
  });
}

// 暂停任务
async function pauseJob(jobId: string): Promise<void> {
  return apiRequest(`/jobs/${jobId}/pause`, {
    method: 'POST'
  });
}

// 恢复任务
async function resumeJob(jobId: string): Promise<void> {
  return apiRequest(`/jobs/${jobId}/resume`, {
    method: 'POST'
  });
}

// 批量操作
async function batchOperation(
  jobIds: string[],
  operation: 'run' | 'pause' | 'resume'
): Promise<void> {
  await Promise.all(
    jobIds.map(id => {
      switch (operation) {
        case 'run': return runJob(id);
        case 'pause': return pauseJob(id);
        case 'resume': return resumeJob(id);
      }
    })
  );
}
```

### 审批流程

```typescript
interface ApprovalRequest {
  stage: string;
  comment?: string;
}

// 批准当前阶段
async function approveJob(
  jobId: string,
  stage: string,
  comment?: string
): Promise<void> {
  return apiRequest(`/jobs/${jobId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ stage, comment })
  });
}

// 拒绝当前阶段
async function rejectJob(
  jobId: string,
  stage: string,
  reason: string,
  comment?: string
): Promise<void> {
  return apiRequest(`/jobs/${jobId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ stage, reason, comment })
  });
}

// 使用示例
try {
  await approveJob('job_123', 'PLAN', '计划内容很详细，可以继续执行');
  console.log('审批通过');
} catch (error) {
  console.error('审批失败:', error.message);
}
```

## 📦 Artifacts API 使用

### 查询产物

```typescript
interface Artifact {
  id: string;
  jobId: string;
  stage: string;
  type: string;
  content: string;
  metadata?: any;
  createdAt: string;
}

async function getArtifacts(jobId: string): Promise<Artifact[]> {
  return apiRequest(`/jobs/${jobId}/artifacts`);
}

// 按阶段获取产物
async function getStageArtifact(
  jobId: string,
  stage: string
): Promise<Artifact | null> {
  const artifacts = await getArtifacts(jobId);
  return artifacts.find(a => a.stage === stage) || null;
}

// 等待特定阶段的产物
async function waitForStageArtifact(
  jobId: string,
  stage: string,
  timeoutMs = 300000 // 5分钟超时
): Promise<Artifact> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const artifact = await getStageArtifact(jobId, stage);
    
    if (artifact) {
      return artifact;
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  throw new Error(`等待 ${stage} 阶段产物超时`);
}
```

### 下载产物

```typescript
// 下载文件类型的产物
async function downloadArtifact(
  jobId: string,
  artifactId: string,
  filename: string
): Promise<void> {
  const response = await fetch(
    `/jobs/${jobId}/artifacts/${artifactId}/download`,
    {
      headers: {
        'Accept': 'application/octet-stream'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`下载失败: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}
```

## 🔄 Workflow Engine API 使用

### 执行工作流指令

```typescript
interface WorkflowCommandRequest {
  jobId: string;
  command: string;
  params?: Record<string, any>;
}

async function executeWorkflowCommand(
  request: WorkflowCommandRequest
): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  return apiRequest('/workflow-engine/execute', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

// 常用指令示例
async function jumpToStage(jobId: string, stage: string): Promise<void> {
  await executeWorkflowCommand({
    jobId,
    command: 'jump-to',
    params: { stage }
  });
}

async function retryStage(jobId: string, stage: string): Promise<void> {
  await executeWorkflowCommand({
    jobId,
    command: 'retry-stage',
    params: { stage }
  });
}

async function modifyStageParams(
  jobId: string,
  stage: string,
  modifications: Record<string, any>
): Promise<void> {
  await executeWorkflowCommand({
    jobId,
    command: 'modify-stage',
    params: { stage, modifications }
  });
}
```

### 查询指令历史

```typescript
interface WorkflowCommand {
  id: string;
  jobId: string;
  command: string;
  params: any;
  status: 'EXECUTING' | 'SUCCESS' | 'FAILED';
  result?: any;
  error?: string;
  createdAt: string;
}

async function getCommandHistory(jobId: string): Promise<WorkflowCommand[]> {
  return apiRequest(`/workflow-engine/commands/${jobId}`);
}
```

## 💬 Chat SSE API 使用

### 建立 SSE 连接

```typescript
class ChatSSEClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(jobId: string, onMessage?: (data: any) => void): void {
    const url = `/jobs/${jobId}/chat/sse`;
    this.eventSource = new EventSource(url);

    // 监听消息事件
    this.eventSource.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      onMessage?.(data);
      this.emit('message', data);
    });

    // 监听其他事件类型
    this.eventSource.addEventListener('approval_request', (event) => {
      const data = JSON.parse(event.data);
      this.emit('approval_request', data);
    });

    this.eventSource.addEventListener('workflow_command', (event) => {
      const data = JSON.parse(event.data);
      this.emit('workflow_command', data);
    });

    this.eventSource.addEventListener('error', (event) => {
      this.emit('error', event);
    });

    this.eventSource.addEventListener('open', () => {
      this.emit('open');
    });
  }

  // 发送消息
  async sendMessage(jobId: string, message: string): Promise<void> {
    await fetch(`/jobs/${jobId}/chat/sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `message=${encodeURIComponent(message)}`
    });
  }

  // 事件监听
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // 触发事件
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  // 断开连接
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.listeners.clear();
  }
}
```

### AI 对话示例

```typescript
const chatClient = new ChatSSEClient();

// 建立连接
chatClient.connect('job_123', (data) => {
  if (data.delta) {
    // 实时显示 AI 回复
    console.log('AI:', data.delta);
  }
});

// 监听审批请求
chatClient.on('approval_request', (data) => {
  console.log(`收到 ${data.stage} 阶段审批请求`);
  // 可以在这里显示审批界面
});

// 发送消息
await chatClient.sendMessage('job_123', '任务进展如何？');
await chatClient.sendMessage('job_123', '跳过大纲阶段');
```

## 🎯 最佳实践

### 1. 错误处理和重试

```typescript
async function robustApiCall<T>(
  apiCall: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 4xx 错误不重试
      if (error instanceof APIError && error.status < 500) {
        throw error;
      }
      
      // 指数退避
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('重试失败');
}
```

### 2. 请求限流

```typescript
class RateLimiter {
  private lastRequest = 0;
  private minInterval: number;

  constructor(requestsPerSecond: number) {
    this.minInterval = 1000 / requestsPerSecond;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequest = Date.now();
  }
}

// 使用示例
const rateLimiter = new RateLimiter(10); // 每秒最多10个请求

async function limitedApiCall(url: string, options?: RequestInit) {
  await rateLimiter.wait();
  return apiRequest(url, options);
}
```

### 3. 缓存策略

```typescript
class APICache {
  private cache = new Map<string, { data: any; expiry: number }>();

  set(key: string, data: any, ttlMs = 300000): void { // 5分钟默认TTL
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

const apiCache = new APICache();

// 带缓存的 API 调用
async function getCachedJob(jobId: string): Promise<Job> {
  const cacheKey = `job:${jobId}`;
  
  let job = apiCache.get(cacheKey);
  if (job) {
    return job;
  }
  
  job = await getJob(jobId);
  apiCache.set(cacheKey, job, 60000); // 缓存1分钟
  
  return job;
}
```

### 4. 批量操作优化

```typescript
// 并发控制
async function batchRequest<T, R>(
  items: T[],
  requestFn: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(item => requestFn(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}

// 使用示例：批量获取任务状态
const jobIds = ['job_1', 'job_2', 'job_3', 'job_4', 'job_5'];
const jobs = await batchRequest(jobIds, getJob, 3);
```

## 📊 监控和调试

### 请求日志

```typescript
class APILogger {
  static log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
  }

  static logRequest(method: string, url: string, duration: number, status: number) {
    this.log('info', `${method} ${url}`, {
      duration: `${duration}ms`,
      status
    });
  }

  static logError(method: string, url: string, error: any) {
    this.log('error', `${method} ${url} failed`, error);
  }
}

// 包装 API 调用以添加日志
async function loggedApiRequest(url: string, options: RequestInit = {}) {
  const startTime = Date.now();
  const method = options.method || 'GET';
  
  try {
    const result = await apiRequest(url, options);
    const duration = Date.now() - startTime;
    
    APILogger.logRequest(method, url, duration, 200);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    APILogger.logError(method, url, error);
    throw error;
  }
}
```

---

📖 **下一步**: 查看 [调试指南](./debugging.md) 学习问题排查技巧。
