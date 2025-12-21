# Chat SSE API

实时通信接口，提供基于 Server-Sent Events (SSE) 的流式对话和状态推送功能。

## 概述

Chat SSE API 是 Rematrix Server 的实时通信核心，支持：
- 流式 AI 对话（基于 OpenRouter）
- 工作流指令执行状态推送
- 审批请求和响应处理
- 实时任务状态更新

## 基础信息

- **协议**: Server-Sent Events (SSE)
- **Content-Type**: `text/event-stream; charset=utf-8`
- **连接方式**: 长连接，支持双向通信
- **编码**: UTF-8

---

## 接口详情

### 1. 建立 SSE 连接

建立与指定任务的实时通信连接。

```http
GET /jobs/{jobId}/chat/sse?message={initialMessage}
```

**路径参数**:
- `jobId` (string): 任务 ID

**查询参数**:
- `message` (string, 可选): 初始消息内容

**连接建立流程**:

1. **客户端发起连接**
```javascript
const eventSource = new EventSource(
  `/jobs/job_123/chat/sse?message=你好，我想了解任务进展`,
  { withCredentials: false }
);
```

2. **服务器响应头**
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

---

## 事件类型详解

### 1. message 事件

接收 AI 助手的流式回复。

```javascript
eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.delta) {
    // 流式内容增量
    console.log('收到增量内容:', data.delta);
    appendToChat(data.delta);
  } else if (data.content) {
    // 完整消息（流式结束）
    console.log('完整消息:', data.content);
    console.log('消息ID:', data.id);
  }
});
```

**数据格式**:

**流式增量**:
```json
{
  "role": "assistant",
  "delta": "当前任务正在"
}
```

**完整消息**:
```json
{
  "id": "msg_456",
  "role": "assistant", 
  "content": "当前任务正在执行 NARRATION 阶段，预计还需要 5 分钟完成。",
  "done": true
}
```

### 2. workflow_command 事件

工作流指令执行状态推送。

```javascript
eventSource.addEventListener('workflow_command', (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'executing':
      console.log(`正在执行指令: ${data.command}`);
      showExecutingIndicator(data.command, data.params);
      break;
      
    case 'completed':
      console.log(`指令完成: ${data.command}`);
      hideExecutingIndicator();
      showResult(data.result);
      break;
      
    case 'failed':
      console.error(`指令失败: ${data.command}`, data.error);
      showError(data.error);
      break;
  }
});
```

**数据格式**:

**开始执行**:
```json
{
  "type": "executing",
  "command": "skip_stage",
  "params": {
    "stage": "OUTLINE"
  }
}
```

**执行完成**:
```json
{
  "type": "completed",
  "command": "skip_stage", 
  "params": {
    "stage": "OUTLINE"
  },
  "result": {
    "message": "已跳过 OUTLINE 阶段",
    "affectedStages": ["OUTLINE", "STORYBOARD"]
  }
}
```

**执行失败**:
```json
{
  "type": "failed",
  "command": "retry_stage",
  "params": {
    "stage": "NARRATION"
  },
  "error": "阶段 NARRATION 不是失败状态，无法重试"
}
```

### 3. approval_request 事件

审批请求推送。

```javascript
eventSource.addEventListener('approval_request', (event) => {
  const data = JSON.parse(event.data);
  
  console.log(`收到 ${data.stage} 阶段审批请求`);
  
  // 显示审批界面
  showApprovalDialog({
    messageId: data.messageId,
    stage: data.stage,
    summary: data.artifactSummary,
    actions: data.actions
  });
});
```

**数据格式**:
```json
{
  "messageId": "msg_789",
  "stage": "PLAN",
  "artifactSummary": "当前阶段 PLAN 的物料已生成，请确认是否继续。",
  "actions": [
    { "key": "approve", "label": "确认" },
    { "key": "reject", "label": "拒绝" }
  ]
}
```

### 4. error 事件

错误信息推送。

```javascript
eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('SSE 错误:', data.message);
  
  // 显示错误提示
  showErrorNotification(data.message);
});
```

**数据格式**:
```json
{
  "message": "message is required"
}
```

### 5. done 事件

连接正常结束。

```javascript
eventSource.addEventListener('done', (event) => {
  const data = JSON.parse(event.data);
  console.log('SSE 连接正常结束:', data);
  
  // 关闭连接
  eventSource.close();
});
```

**数据格式**:
```json
{
  "ok": true
}
```

---

## 代码逻辑详解

### SSE 连接管理

```typescript
// JobsController.chatSse()
async chatSse(
  @Param('id') id: string,
  @Query('message') message: string,
  @Res() res: Response,
) {
  // 1. 设置 SSE 响应头
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // 2. 连接状态管理
  const abortController = new AbortController();
  let clientClosed = false;
  
  res.on('close', () => {
    clientClosed = true;
    abortController.abort();
  });

  // 3. 事件发送函数
  const sendEvent = (event: string, data: unknown) => {
    if (clientClosed || res.writableEnded) return;
    
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 4. 处理初始消息
    await this.handleInitialMessage(id, message, sendEvent);
    
    // 5. 检查审批状态
    await this.checkApprovalStatus(id, sendEvent);
    
    // 6. 发送完成信号
    if (!clientClosed && !res.writableEnded) {
      sendEvent('done', { ok: true });
      res.end();
    }
    
  } catch (err: unknown) {
    if (clientClosed || res.writableEnded) return;
    
    const message = err instanceof Error ? err.message : String(err);
    sendEvent('error', { message });
    res.end();
  }
}
```

### 指令处理逻辑

```typescript
// JobsController.handleInitialMessage()
private async handleInitialMessage(
  jobId: string,
  message: string,
  sendEvent: (event: string, data: unknown) => void
) {
  // 1. 验证消息
  if (!message || String(message).trim().length === 0) {
    sendEvent('error', { message: 'message is required' });
    return;
  }

  // 2. 持久化用户消息
  const userMessage = await this.jobs.chatMessages.create(
    jobId,
    'user',
    message,
  );
  sendEvent('message', {
    id: userMessage.id,
    role: 'user',
    content: message,
  });

  // 3. 检查是否为工作流指令
  const commandResult = this.workflowEngine.parseCommand(message);
  const naturalResult = this.workflowEngine.parseNaturalLanguage(message);

  if (commandResult || naturalResult) {
    await this.executeWorkflowCommand(
      jobId,
      commandResult || naturalResult,
      sendEvent
    );
    return;
  }

  // 4. AI 对话处理
  await this.handleAIChat(jobId, message, sendEvent);
}
```

### 工作流指令执行

```typescript
// JobsController.executeWorkflowCommand()
private async executeWorkflowCommand(
  jobId: string,
  parsedCommand: any,
  sendEvent: (event: string, data: unknown) => void
) {
  try {
    // 1. 发送执行状态
    sendEvent('workflow_command', {
      type: 'executing',
      command: parsedCommand.command,
      params: parsedCommand.params,
    });

    // 2. 执行指令
    const result = await this.workflowEngine.executeCommand({
      jobId,
      command: parsedCommand.command,
      params: parsedCommand.params,
    });

    // 3. 发送执行结果
    sendEvent('workflow_command', {
      type: 'completed',
      command: parsedCommand.command,
      params: parsedCommand.params,
      result: result,
    });

    // 4. 持久化助手回复
    const assistantMessage = await this.jobs.chatMessages.create(
      jobId,
      'assistant',
      result.message,
      { type: 'workflow_command', command: parsedCommand.command },
    );
    
    sendEvent('message', {
      id: assistantMessage.id,
      role: 'assistant',
      content: result.message,
    });

  } catch (error) {
    // 5. 处理执行失败
    sendEvent('workflow_command', {
      type: 'failed',
      command: parsedCommand.command,
      params: parsedCommand.params,
      error: error instanceof Error ? error.message : String(error),
    });

    const errorMessage = await this.jobs.chatMessages.create(
      jobId,
      'assistant',
      `指令执行失败: ${error instanceof Error ? error.message : String(error)}`,
      { type: 'workflow_command_error', command: parsedCommand.command },
    );
    
    sendEvent('message', {
      id: errorMessage.id,
      role: 'assistant',
      content: errorMessage.content,
    });
  }
}
```

### AI 对话处理

```typescript
// JobsController.handleAIChat()
private async handleAIChat(
  jobId: string,
  message: string,
  sendEvent: (event: string, data: unknown) => void
) {
  // 1. 获取任务上下文
  const job = await this.jobs.get(jobId);
  const config = (job.config as { markdown?: string } | null) ?? null;
  const markdown = config?.markdown ?? '';

  // 2. 配置 AI 模型
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    sendEvent('error', { message: 'Missing OPENROUTER_API_KEY' });
    return;
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const model = openai('google/gemini-3.0-flash');

  // 3. 启动流式对话
  const result = streamText({
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: '你是 Rematrix 的助手。你需要根据 Job 的上下文回答用户问题。输出简洁、可操作。',
      },
      {
        role: 'user',
        content: `JobId: ${jobId}\nCurrentStage: ${job.currentStage}\n\nMarkdown:\n${markdown}\n\nUserMessage:\n${message}`,
      },
    ],
  });

  // 4. 流式发送内容
  let assistantContent = '';
  for await (const delta of result.textStream) {
    if (res.writableEnded) break;
    
    assistantContent += delta;
    sendEvent('message', { role: 'assistant', delta });
  }

  // 5. 持久化完整回复
  if (assistantContent && !res.writableEnded) {
    const assistantMessage = await this.jobs.chatMessages.create(
      jobId,
      'assistant',
      assistantContent,
    );
    
    sendEvent('message', {
      id: assistantMessage.id,
      role: 'assistant',
      content: assistantContent,
      done: true,
    });
  }
}
```

### 审批状态检查

```typescript
// JobsController.checkApprovalStatus()
private async checkApprovalStatus(
  jobId: string,
  sendEvent: (event: string, data: unknown) => void
) {
  const job = await this.jobs.get(jobId);
  
  // 检查是否需要审批
  if (job.status === 'WAITING_APPROVAL' && !res.writableEnded) {
    const approvalMessage = await this.jobs.chatMessages.create(
      jobId,
      'assistant',
      `请确认当前阶段 ${job.currentStage} 的物料是否满足要求？`,
      { type: 'approval_request', stage: job.currentStage },
    );
    
    sendEvent('approval_request', {
      messageId: approvalMessage.id,
      stage: job.currentStage,
      artifactSummary: `当前阶段 ${job.currentStage} 的物料已生成，请确认是否继续。`,
      actions: [
        { key: 'approve', label: '确认' },
        { key: 'reject', label: '拒绝' },
      ],
    });
  }
}
```

---

## 前端集成示例

### React Hook 封装

```typescript
// useSSEChat Hook
const useSSEChat = (jobId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLoading(true);
    
    const eventSource = new EventSource(`/jobs/${jobId}/chat/sse`);
    eventSourceRef.current = eventSource;

    let currentAssistantMessage = '';

    eventSource.onopen = () => {
      setIsConnected(true);
      setLoading(false);
    };

    eventSource.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      
      if (data.delta) {
        // 流式增量
        currentAssistantMessage += data.delta;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          
          if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.done) {
            lastMessage.content += data.delta;
          } else {
            newMessages.push({
              role: 'assistant',
              content: data.delta,
              done: false
            });
          }
          
          return newMessages;
        });
      } else if (data.content) {
        // 完整消息
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.id = data.id;
            lastMessage.done = data.done;
          }
          
          return newMessages;
        });
        currentAssistantMessage = '';
      }
    });

    eventSource.addEventListener('workflow_command', (event) => {
      const data = JSON.parse(event.data);
      
      setMessages(prev => [...prev, {
        role: 'system',
        type: 'workflow_command',
        content: `${data.type}: ${data.command}`,
        data
      }]);
    });

    eventSource.addEventListener('approval_request', (event) => {
      const data = JSON.parse(event.data);
      
      setMessages(prev => [...prev, {
        role: 'system',
        type: 'approval_request',
        content: `需要审批 ${data.stage} 阶段`,
        data
      }]);
    });

    eventSource.addEventListener('error', (event) => {
      const data = JSON.parse(event.data);
      console.error('SSE Error:', data.message);
      setIsConnected(false);
      setLoading(false);
    });

    eventSource.addEventListener('done', () => {
      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      setLoading(false);
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [jobId]);

  const sendMessage = useCallback((message: string) => {
    if (!isConnected || !eventSourceRef.current) return;
    
    // 添加用户消息到本地状态
    setMessages(prev => [...prev, {
      role: 'user',
      content: message
    }]);
    
    // 重新连接以发送消息
    connect();
  }, [isConnected, connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    messages,
    isConnected,
    loading,
    sendMessage,
    disconnect
  };
};
```

### 聊天组件

```typescript
// ChatComponent
const ChatComponent = ({ jobId }: { jobId: string }) => {
  const { messages, isConnected, loading, sendMessage } = useSSEChat(jobId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !isConnected) return;
    
    sendMessage(input);
    setInput('');
  };

  const handleApproval = (messageId: string, action: 'approve' | 'reject') => {
    // 处理审批逻辑
    fetch(`/jobs/${jobId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'PLAN', // 从消息数据中获取
        comment: action === 'approve' ? '确认通过' : '需要修改'
      })
    });
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="content">{message.content}</div>
            
            {message.type === 'approval_request' && (
              <div className="approval-actions">
                <button onClick={() => handleApproval(message.data.messageId, 'approve')}>
                  确认
                </button>
                <button onClick={() => handleApproval(message.data.messageId, 'reject')}>
                  拒绝
                </button>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息或指令..."
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          disabled={!isConnected || loading}
        />
        <button onClick={handleSend} disabled={!isConnected || loading}>
          {loading ? '连接中...' : '发送'}
        </button>
      </div>
      
      <div className="status">
        状态: {isConnected ? '已连接' : '未连接'}
      </div>
    </div>
  );
};
```

---

## 性能优化

### 连接管理

1. **连接池**: 复用 SSE 连接，避免频繁重连
2. **心跳检测**: 定期发送心跳保持连接
3. **断线重连**: 自动重连机制，指数退避
4. **资源清理**: 组件卸载时正确关闭连接

### 消息优化

1. **消息压缩**: 大消息使用 gzip 压缩
2. **增量更新**: 只发送变化的部分
3. **消息去重**: 避免重复消息
4. **缓存策略**: 本地缓存历史消息

---

## 故障排查

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 连接频繁断开 | 网络不稳定或服务器超时 | 增加超时时间，实现重连机制 |
| 消息丢失 | 客户端处理不及时 | 添加消息队列和确认机制 |
| 内存泄漏 | 事件监听器未正确清理 | 确保组件卸载时清理资源 |
| 指令无响应 | 工作流状态不匹配 | 检查任务状态和执行条件 |

### 调试工具

```typescript
// SSE 调试工具
class SSEDebugger {
  private events: any[] = [];
  
  log(event: string, data: any) {
    this.events.push({
      timestamp: new Date().toISOString(),
      event,
      data: JSON.parse(JSON.stringify(data))
    });
    
    console.log(`[SSE] ${event}:`, data);
  }
  
  getHistory() {
    return this.events;
  }
  
  export() {
    const blob = new Blob([JSON.stringify(this.events, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sse-debug-${Date.now()}.json`;
    a.click();
  }
}

// 使用示例
const debugger = new SSEDebugger();

eventSource.addEventListener('message', (event) => {
  debugger.log('message', JSON.parse(event.data));
});
```

---

*相关文档*: [Jobs API](./jobs.md) | [Workflow Engine API](./workflow-engine.md) | [AI 集成架构](../architecture/ai-integration.md)
