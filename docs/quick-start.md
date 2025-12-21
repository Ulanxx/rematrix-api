# 快速开始指南

## 🚀 5分钟快速上手

### 前置要求

- **Node.js**: >= 20.0.0
- **pnpm**: >= 8.0.0  
- **Docker**: >= 20.0.0
- **PostgreSQL**: >= 14.0

### 1. 环境搭建

```bash
# 克隆项目
git clone <repository-url>
cd rematrix-server

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入必要配置
```

### 2. 启动服务

```bash
# 启动数据库（如果使用 Docker）
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:14

# 启动 Temporal Server
docker compose -f temporal-docker-compose-min.yml up -d

# 运行数据库迁移
pnpm prisma migrate dev

# 启动 Temporal Worker（新终端）
pnpm temporal:worker

# 启动 API Server（新终端）
pnpm start:dev
```

### 3. 验证安装

```bash
# 检查 API 服务
curl http://localhost:3000

# 检查 Temporal UI
open http://localhost:8233

# 测试创建任务
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"config":{"markdown":"# 测试文档\n\n这是一个测试。"}}'
```

## 📚 核心概念

### Job（任务）
一次完整的"从 Markdown 到视频"转换过程，包含多个阶段和产物。

### Artifact（产物）  
每个阶段生成的具体内容，如大纲、分镜、口播稿、页面等。

### Stage（阶段）
视频生成的具体步骤：`PLAN → OUTLINE → NARRATION → PAGES → RENDER → MERGE`

### Approval（审批）
需要人工确认的关键节点，用户可以修改、确认或拒绝当前阶段的产物。

## 🔌 核心 API 使用

### 创建视频生成任务

```typescript
// 1. 创建任务
const response = await fetch('http://localhost:3000/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config: {
      markdown: `
# 深度学习入门

## 基础概念
深度学习是机器学习的一个重要分支...

## 神经网络
神经网络的基本结构包括输入层、隐藏层和输出层...
      `.trim()
    }
  })
});

const { jobId } = await response.json();
console.log('任务已创建:', jobId);
```

### 启动工作流

```typescript
// 2. 启动视频生成工作流
await fetch(`http://localhost:3000/jobs/${jobId}/run`, {
  method: 'POST'
});

console.log('工作流已启动');
```

### 查询任务状态

```typescript
// 3. 查询任务进度
const statusResponse = await fetch(`http://localhost:3000/jobs/${jobId}`);
const job = await statusResponse.json();

console.log('任务状态:', job.status);
console.log('当前阶段:', job.currentStage);
```

### 审批流程

```typescript
// 4. 当任务需要审批时
if (job.status === 'WAITING_APPROVAL') {
  // 批准当前阶段
  await fetch(`http://localhost:3000/jobs/${jobId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stage: 'PLAN',
      comment: '计划看起来不错，继续执行'
    })
  });
  
  console.log('已批准，工作流继续执行');
}
```

## 🔄 实时通信 (SSE)

### 建立 SSE 连接

```typescript
// 建立实时连接
const eventSource = new EventSource(`/jobs/${jobId}/chat/sse`);

// 监听 AI 助手回复
eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.delta) {
    console.log('AI 回复:', data.delta);
  }
});

// 监听审批请求
eventSource.addEventListener('approval_request', (event) => {
  const data = JSON.parse(event.data);
  console.log(`收到 ${data.stage} 阶段审批请求`);
});

// 监听工作流指令执行状态
eventSource.addEventListener('workflow_command', (event) => {
  const data = JSON.parse(event.data);
  console.log(`指令 ${data.command}: ${data.type}`);
});
```

### 发送工作流指令

```typescript
// 自然语言指令
const naturalCommands = [
  '跳过大纲阶段',
  '重试口播稿生成', 
  '暂停工作流',
  '继续执行'
];

// 指令格式
const formalCommands = [
  '/jump-to NARRATION',
  '/retry_stage stage=NARRATION',
  '/pause',
  '/resume'
];

// 通过 SSE 发送指令
eventSource.addEventListener('open', () => {
  // 发送自然语言指令
  fetch(`/jobs/${jobId}/chat/sse?message=跳过大纲阶段`);
});
```

## 📊 查看产物

```typescript
// 获取所有产物
const artifactsResponse = await fetch(`/jobs/${jobId}/artifacts`);
const { artifacts } = await artifactsResponse.json();

// 按阶段分组
const byStage = artifacts.reduce((acc, artifact) => {
  acc[artifact.stage] = artifact;
  return acc;
}, {});

console.log('计划:', byStage.PLAN?.content);
console.log('口播稿:', byStage.NARRATION?.content);
```

## 🛠️ 开发工具

### Temporal UI 监控
访问 http://localhost:8233 查看：
- 工作流执行状态
- 任务历史记录
- 错误和重试信息
- 性能指标

### API 测试工具
```bash
# 使用 curl 测试
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"config":{"markdown":"# 测试"}}'

# 使用 httpie 测试  
http POST localhost:3000/jobs config:='{"markdown":"# 测试"}'
```

### 日志查看
```bash
# 查看 API 服务日志
pnpm start:dev --verbose

# 查看 Worker 日志
pnpm temporal:worker --verbose

# 查看 Temporal 日志
docker compose logs temporal
```

## 🔧 常用操作

### 错误处理
```typescript
try {
  const response = await fetch(`/jobs/${jobId}/run`, { method: 'POST' });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('启动失败:', error.error.message);
  }
} catch (error) {
  console.error('网络错误:', error);
}
```

### 批量操作
```typescript
// 批量查询多个任务
const jobIds = ['job_1', 'job_2', 'job_3'];
const jobs = await Promise.all(
  jobIds.map(id => fetch(`/jobs/${id}`).then(r => r.json()))
);

console.log('批量任务状态:', jobs);
```

### 条件查询
```typescript
// 只查询特定状态的任务
const response = await fetch('/jobs?status=RUNNING&limit=10');
const { jobs } = await response.json();
```

## 🎯 最佳实践

### 1. 错误处理
- 总是检查 API 响应状态
- 实现重试机制
- 记录错误日志

### 2. 性能优化
- 使用 SSE 轮询替代定时轮询
- 缓存任务状态
- 批量处理操作

### 3. 用户体验
- 提供实时进度反馈
- 支持操作取消
- 友好的错误提示

## 📞 获取帮助

- **API 文档**: 查看 `api/` 目录下的详细文档
- **架构说明**: 查看 `architecture/` 目录下的架构文档
- **代码示例**: 参考各 API 文档中的示例代码
- **问题排查**: 查看 API 文档的错误处理部分

## 🚀 下一步

- [查看 Jobs API 详细文档](./api/jobs.md)
- [了解 NestJS 架构设计](./architecture/nestjs.md)
- [学习 Temporal 工作流](./architecture/temporal.md)
- [部署到生产环境](./deployment.md)

---

🎉 **恭喜！** 你已经掌握了 Rematrix Server 的基本使用方法。

现在可以开始构建你的视频生成应用了！
