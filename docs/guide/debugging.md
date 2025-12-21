# 调试指南

本指南提供 Rematrix Server 的调试技巧、问题排查和故障解决方案。

## 🔧 调试工具

### 1. 日志系统

#### 启用调试日志

```bash
# 设置环境变量
export DEBUG=rematrix:*
export LOG_LEVEL=debug

# 启动服务
pnpm start:dev
```

#### 查看实时日志

```bash
# API 服务日志
pnpm start:dev --verbose

# Worker 日志
pnpm temporal:worker --verbose

# Docker 容器日志
docker compose logs -f app
docker compose logs -f worker
```

#### 日志级别说明

| 级别 | 用途 | 示例场景 |
|------|------|----------|
| `error` | 错误信息 | API 调用失败、数据库连接错误 |
| `warn` | 警告信息 | 性能问题、配置警告 |
| `info` | 一般信息 | 任务创建、状态变更 |
| `debug` | 调试信息 | 详细的执行流程、变量值 |

### 2. 开发者工具

#### VS Code 调试配置

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS API",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/nest",
      "args": ["start", "--debug", "--watch"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "rematrix:*"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    },
    {
      "name": "Debug Temporal Worker",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/ts-node",
      "args": ["src/temporal/worker.ts"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "rematrix:*"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

#### 浏览器调试

```typescript
// 在代码中添加调试断点
console.debug('Debug info:', { jobId, status, stage });

// 使用 debugger 语句
if (process.env.NODE_ENV === 'development') {
  debugger;
}
```

## 🐛 常见问题排查

### 1. API 服务问题

#### 服务无法启动

```bash
# 检查端口占用
lsof -i :3000

# 检查环境变量
printenv | grep -E "(DATABASE|TEMPORAL|OPENROUTER)"

# 检查配置文件
cat .env
```

**常见原因**：
- 端口被占用
- 环境变量配置错误
- 数据库连接失败
- 依赖包版本冲突

**解决方案**：
```bash
# 杀死占用进程
kill -9 $(lsof -ti:3000)

# 重新安装依赖
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 检查数据库连接
pnpm prisma db pull
```

#### API 请求失败

```bash
# 测试基础连接
curl -I http://localhost:3000

# 检查健康状态
curl http://localhost:3000/health

# 查看详细错误
curl -v http://localhost:3000/jobs
```

**调试步骤**：
1. 检查请求格式和参数
2. 查看服务器日志
3. 验证认证信息
4. 检查数据库状态

### 2. 数据库问题

#### 连接失败

```bash
# 测试数据库连接
psql $DATABASE_URL -c "SELECT 1;"

# 检查数据库状态
docker ps | grep postgres

# 查看数据库日志
docker logs postgres-dev
```

#### 迁移问题

```bash
# 检查迁移状态
pnpm prisma migrate status

# 重置数据库（谨慎使用）
pnpm prisma migrate reset

# 重新生成客户端
pnpm prisma generate
```

### 3. Temporal 工作流问题

#### Worker 连接问题

```bash
# 检查 Temporal 服务
curl http://localhost:7233

# 查看 Temporal UI
open http://localhost:8233

# 检查 Worker 日志
pnpm temporal:worker --verbose
```

#### 工作流执行失败

```typescript
// 在 Worker 中添加调试日志
import { Logger } from '@nestjs/common';

@Activity()
async generatePlan(input: any) {
  this.logger.debug('开始生成计划', { input });
  
  try {
    const result = await this.aiService.generatePlan(input);
    this.logger.debug('计划生成完成', { result });
    return result;
  } catch (error) {
    this.logger.error('计划生成失败', error);
    throw error;
  }
}
```

### 4. AI 服务问题

#### API 调用失败

```bash
# 测试 OpenRouter 连接
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/models

# 检查 API Key
echo $OPENROUTER_API_KEY | cut -c1-10
```

**调试代码**：
```typescript
// 添加详细的错误日志
try {
  const response = await this.openrouter.chat.completions.create({
    model: this.aiModel,
    messages: [{ role: 'user', content: prompt }],
    temperature: parseFloat(this.aiTemperature),
  });
  
  this.logger.debug('AI 响应', {
    model: this.aiModel,
    usage: response.usage,
    contentLength: response.choices[0].message.content.length
  });
  
  return response.choices[0].message.content;
} catch (error) {
  this.logger.error('AI 调用失败', {
    error: error.message,
    status: error.status,
    model: this.aiModel
  });
  throw error;
}
```

## 🔍 性能调试

### 1. 响应时间分析

```typescript
// 添加性能监控
import { performance } from 'perf_hooks';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = performance.now();
    
    return next.handle().pipe(
      tap(() => {
        const duration = performance.now() - start;
        console.log(`${context.getHandler().name} 执行时间: ${duration.toFixed(2)}ms`);
      })
    );
  }
}
```

### 2. 内存使用监控

```bash
# 查看内存使用
node --inspect dist/main.js

# 在 Chrome DevTools 中查看
chrome://inspect

# 监控内存泄漏
node --inspect --trace-warnings dist/main.js
```

### 3. 数据库查询优化

```typescript
// 启用查询日志
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Params: ' + e.params);
  console.log('Duration: ' + e.duration + 'ms');
});
```

## 🧪 测试调试

### 1. 单元测试调试

```bash
# 运行测试并显示覆盖率
pnpm test --coverage

# 调试特定测试
pnpm test -- --testNamePattern="JobsService"

# 监听模式
pnpm test --watch
```

### 2. 集成测试调试

```typescript
// 添加测试日志
describe('JobsController', () => {
  let controller: JobsController;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [JobsService],
    }).compile();
    
    controller = module.get<JobsController>(JobsController);
    console.log('测试环境初始化完成');
  });
  
  it('should create job', async () => {
    const result = await controller.createJob({
      config: { markdown: '# Test' }
    });
    
    console.log('创建任务结果:', result);
    expect(result).toHaveProperty('jobId');
  });
});
```

## 📊 监控和分析

### 1. 应用指标

```typescript
// 添加指标收集
import { Counter, Histogram, register } from 'prom-client';

const requestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
});

// 在拦截器中使用
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        requestCounter
          .labels(request.method, request.route.path, '200')
          .inc();
        requestDuration
          .labels(request.method, request.route.path)
          .observe(duration / 1000);
      })
    );
  }
}
```

### 2. 错误追踪

```typescript
// 全局异常处理
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : 500;
    
    // 记录错误日志
    console.error('未处理的异常:', {
      exception,
      method: request.method,
      url: request.url,
      body: request.body,
      headers: request.headers,
      timestamp: new Date().toISOString(),
    });
    
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error',
    });
  }
}
```

## 🛠️ 调试工具集

### 1. 开发脚本

创建 `scripts/debug.sh`：

```bash
#!/bin/bash

# 调试脚本
echo "🔍 Rematrix Server 调试工具"

# 检查服务状态
check_services() {
  echo "📊 检查服务状态..."
  
  # API 服务
  if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ API 服务正常"
  else
    echo "❌ API 服务异常"
  fi
  
  # Temporal 服务
  if curl -s http://localhost:7233 > /dev/null; then
    echo "✅ Temporal 服务正常"
  else
    echo "❌ Temporal 服务异常"
  fi
  
  # 数据库
  if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ 数据库连接正常"
  else
    echo "❌ 数据库连接异常"
  fi
}

# 查看日志
view_logs() {
  echo "📋 查看日志..."
  
  case $1 in
    api)
      docker compose logs -f app
      ;;
    worker)
      docker compose logs -f worker
      ;;
    temporal)
      docker compose logs -f temporal
      ;;
    all)
      docker compose logs -f
      ;;
    *)
      echo "用法: $0 logs [api|worker|temporal|all]"
      ;;
  esac
}

# 重启服务
restart_services() {
  echo "🔄 重启服务..."
  docker compose restart
}

# 清理环境
clean() {
  echo "🧹 清理环境..."
  docker compose down -v
  rm -rf node_modules/.cache
  pnpm store prune
}

# 主菜单
case $1 in
  check)
    check_services
    ;;
  logs)
    view_logs $2
    ;;
  restart)
    restart_services
    ;;
  clean)
    clean
    ;;
  *)
    echo "用法: $0 [check|logs|restart|clean]"
    ;;
esac
```

### 2. 调试配置

创建 `debug.config.js`：

```javascript
module.exports = {
  // 开发环境配置
  development: {
    logLevel: 'debug',
    enableMetrics: true,
    enableTracing: true,
    database: {
      logQueries: true,
      logSlowQueries: true,
      slowQueryThreshold: 1000,
    },
    temporal: {
      enableLogging: true,
      logLevel: 'debug',
    },
    ai: {
      enableLogging: true,
      logRequests: true,
      logResponses: true,
    },
  },
  
  // 生产环境配置
  production: {
    logLevel: 'info',
    enableMetrics: true,
    enableTracing: false,
    database: {
      logQueries: false,
      logSlowQueries: true,
      slowQueryThreshold: 500,
    },
    temporal: {
      enableLogging: true,
      logLevel: 'info',
    },
    ai: {
      enableLogging: false,
      logRequests: false,
      logResponses: false,
    },
  },
};
```

## 📋 调试检查清单

### 启动前检查
- [ ] 环境变量配置正确
- [ ] 数据库连接正常
- [ ] Temporal 服务运行
- [ ] AI API Key 有效
- [ ] 端口未被占用

### 运行时检查
- [ ] 日志输出正常
- [ ] 健康检查通过
- [ ] 工作流执行正常
- [ ] 内存使用合理
- [ ] 响应时间正常

### 问题排查步骤
1. **查看日志** - 确定错误类型和位置
2. **检查配置** - 验证环境变量和配置文件
3. **测试连接** - 检查外部服务连接状态
4. **分析性能** - 监控资源使用情况
5. **复现问题** - 在测试环境中重现问题
6. **修复验证** - 确认修复后问题解决

---

📖 **下一步**: 查看 [常见问题](./faq.md) 获取更多解决方案。
