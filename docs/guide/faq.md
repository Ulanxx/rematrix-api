# 常见问题

本文档收集了 Rematrix Server 使用过程中的常见问题和解决方案。

## 🚀 安装和配置

### Q: 安装依赖时出现权限错误

**问题**：`pnpm install` 时提示权限不足

**解决方案**：
```bash
# 方法1：使用 npx
npx pnpm install

# 方法2：检查 npm 配置
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# 方法3：使用 sudo（不推荐）
sudo pnpm install
```

### Q: 环境变量配置后不生效

**问题**：修改 `.env` 文件后，服务仍然使用旧的配置

**解决方案**：
```bash
# 1. 确认文件位置
ls -la .env

# 2. 检查语法错误
cat .env | grep -E "(DATABASE|TEMPORAL|OPENROUTER)"

# 3. 重启服务
pkill -f "nest start"
pnpm start:dev

# 4. 验证环境变量
printenv | grep -E "(DATABASE|TEMPORAL|OPENROUTER)"
```

### Q: TypeScript 配置错误

**问题**：`找不到文件"@tsconfig/node20/tsconfig.json"`

**解决方案**：
```bash
# 安装缺失的依赖
pnpm add -D @tsconfig/node20

# 或者修改 tsconfig.json 使用基础配置
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  }
}
```

## 🗄️ 数据库问题

### Q: 数据库连接失败

**问题**：`Error: getaddrinfo ENOTFOUND postgres`

**解决方案**：
```bash
# 1. 检查 PostgreSQL 是否运行
docker ps | grep postgres

# 2. 启动 PostgreSQL 容器
docker run --name postgres-dev \
  -e POSTGRES_DB=rematrix \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:14

# 3. 测试连接
psql "postgresql://postgres:password@localhost:5432/rematrix" -c "SELECT 1;"

# 4. 更新 DATABASE_URL
export DATABASE_URL="postgresql://postgres:password@localhost:5432/rematrix"
```

### Q: Prisma 迁移失败

**问题**：`Migration failed with error: relation already exists`

**解决方案**：
```bash
# 1. 检查迁移状态
pnpm prisma migrate status

# 2. 重置数据库（会丢失数据）
pnpm prisma migrate reset

# 3. 手动删除表
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 4. 重新运行迁移
pnpm prisma migrate dev
```

### Q: 数据库查询超时

**问题**：查询操作经常超时

**解决方案**：
```typescript
// 在 prisma.service.ts 中增加超时配置
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

// 添加查询超时
async queryWithTimeout<T>(
  query: () => Promise<T>,
  timeoutMs = 30000
): Promise<T> {
  return Promise.race([
    query(),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('查询超时')), timeoutMs)
    )
  ]);
}
```

## ⏰ Temporal 工作流问题

### Q: Temporal Worker 连接失败

**问题**：`Failed to connect to Temporal server`

**解决方案**：
```bash
# 1. 检查 Temporal 服务状态
docker compose ps temporal

# 2. 重启 Temporal
docker compose restart temporal

# 3. 检查网络连接
curl http://localhost:7233

# 4. 验证配置
echo $TEMPORAL_ADDRESS
echo $TEMPORAL_NAMESPACE

# 5. 查看 Temporal 日志
docker compose logs temporal
```

### Q: 工作流卡在某个阶段

**问题**：工作流执行到一半停止响应

**解决方案**：
```bash
# 1. 查看 Temporal UI
open http://localhost:8233

# 2. 检查工作流详情
# 在 UI 中找到卡住的工作流，查看执行历史

# 3. 重启 Worker
pkill -f "temporal:worker"
pnpm temporal:worker

# 4. 发送信号继续执行
# 使用 Workflow Engine API
curl -X POST http://localhost:3000/workflow-engine/execute \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "your-job-id",
    "command": "resume"
  }'
```

### Q: 工作流重试次数过多

**问题**：工作流不断重试，无法完成

**解决方案**：
```typescript
// 在 activity 中添加重试策略
@Activity({
  startToCloseTimeout: '5 minutes',
  retryOptions: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '10 seconds',
    backoffCoefficient: 2,
  },
})
async generatePlan(input: any) {
  // 业务逻辑
}
```

## 🤖 AI 服务问题

### Q: OpenRouter API 调用失败

**问题**：`401 Unauthorized` 或 `429 Too Many Requests`

**解决方案**：
```bash
# 1. 检查 API Key
echo $OPENROUTER_API_KEY

# 2. 测试 API 连接
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models

# 3. 检查配额
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/auth/key

# 4. 更新 API Key
export OPENROUTER_API_KEY="your-new-api-key"
```

### Q: AI 生成内容质量差

**问题**：AI 生成的内容不符合预期

**解决方案**：
```typescript
// 优化提示词
const optimizedPrompt = `
你是一个专业的视频脚本生成助手。请根据以下 Markdown 内容生成详细的视频制作计划。

要求：
1. 结构清晰，包含章节划分
2. 内容准确，突出重点
3. 适合视频讲解的口语化表达
4. 控制在适当的篇幅

原文内容：
${markdown}

请生成视频制作计划：`;

// 调整参数
const response = await this.openrouter.chat.completions.create({
  model: 'anthropic/claude-3-haiku', // 使用更好的模型
  messages: [{ role: 'user', content: optimizedPrompt }],
  temperature: 0.3, // 降低随机性
  max_tokens: 2000, // 控制输出长度
});
```

## 📡 API 接口问题

### Q: API 请求返回 500 错误

**问题**：服务器内部错误，无法确定具体原因

**解决方案**：
```bash
# 1. 查看详细错误日志
pnpm start:dev --verbose

# 2. 检查请求格式
curl -v -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"config":{"markdown":"test"}}'

# 3. 检查数据库状态
pnpm prisma studio

# 4. 查看应用日志
docker compose logs app
```

### Q: SSE 连接断开

**问题**：Server-Sent Events 连接经常断开

**解决方案**：
```typescript
// 客户端重连机制
class ReconnectableSSE {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string) {
    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('error', () => {
      console.log('SSE 连接错误，尝试重连...');
      this.reconnect();
    });

    this.eventSource.addEventListener('close', () => {
      console.log('SSE 连接关闭');
      this.reconnect();
    });
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect(this.url);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }
}
```

## 🚀 性能问题

### Q: 响应时间过长

**问题**：API 响应时间超过预期

**解决方案**：
```typescript
// 1. 启用查询缓存
@Injectable()
export class CacheService {
  private cache = new Map<string, { data: any; expiry: number }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key: string, data: any, ttlMs = 300000): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
  }
}

// 2. 数据库查询优化
async getJobsOptimized(options: GetJobsOptions) {
  return this.prisma.job.findMany({
    where: options.where,
    select: {
      id: true,
      status: true,
      currentStage: true,
      createdAt: true,
      // 只选择必要字段
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit,
    skip: options.offset,
  });
}
```

### Q: 内存使用过高

**问题**：服务内存占用持续增长

**解决方案**：
```bash
# 1. 监控内存使用
node --inspect dist/main.js
# 在 Chrome DevTools 中查看内存使用

# 2. 检查内存泄漏
node --trace-warnings dist/main.js

# 3. 优化代码
// 避免内存泄漏
class JobService {
  private cache = new Map<string, Job>();

  async getJob(id: string): Promise<Job> {
    // 定期清理缓存
    if (this.cache.size > 1000) {
      this.cache.clear();
    }
    
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (job) {
      this.cache.set(id, job);
    }
    return job;
  }
}
```

## 🐛 开发工具问题

### Q: VS Code 调试器无法连接

**问题**：VS Code 调试时显示"无法连接到运行时"

**解决方案**：
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/nest",
      "args": ["start", "--debug", "--watch"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector",
      "sourceMaps": true
    }
  ]
}
```

### Q: 热重载不工作

**问题**：修改代码后服务没有自动重启

**解决方案**：
```bash
# 1. 检查文件监听限制
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 2. 重新安装依赖
rm -rf node_modules
pnpm install

# 3. 清理缓存
pnpm store prune

# 4. 使用 watch 模式
pnpm start:dev --watch
```

## 📦 部署问题

### Q: Docker 构建失败

**问题**：`docker build` 时出现错误

**解决方案**：
```bash
# 1. 检查 Dockerfile
cat Dockerfile

# 2. 清理 Docker 缓存
docker system prune -a

# 3. 重新构建
docker build --no-cache -t rematrix-server .

# 4. 查看构建日志
docker build --progress=plain -t rematrix-server .
```

### Q: 生产环境配置错误

**问题**：生产环境启动失败

**解决方案**：
```bash
# 1. 检查环境变量
docker compose -f docker-compose.prod.yml config

# 2. 查看容器日志
docker compose -f docker-compose.prod.yml logs

# 3. 进入容器调试
docker compose -f docker-compose.prod.yml exec app bash

# 4. 检查网络连接
docker compose -f docker-compose.prod.yml exec app ping postgres
```

## 📞 获取帮助

### 自助排查步骤

1. **查看日志** - 检查应用和服务日志
2. **检查配置** - 验证环境变量和配置文件
3. **测试连接** - 确认外部服务连接正常
4. **重启服务** - 尝试重启相关服务
5. **查阅文档** - 查看相关技术文档

### 社区支持

- **GitHub Issues**: 提交问题和 Bug 报告
- **讨论区**: 技术讨论和经验分享
- **Wiki**: 社区维护的文档和教程

### 联系方式

- **技术支持**: support@rematrix.ai
- **Bug 报告**: bugs@rematrix.ai
- **功能建议**: features@rematrix.ai

---

📖 **更多资源**:
- [调试指南](./debugging.md)
- [API 使用指南](./api-usage.md)
- [部署指南](../deployment.md)
