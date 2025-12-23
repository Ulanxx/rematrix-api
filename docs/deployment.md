# 部署指南

## 📋 目录

- [环境要求](#环境要求)
- [本地开发](#本地开发)
- [生产部署](#生产部署)
- [监控和日志](#监控和日志)

## 🔧 环境要求

### 基础环境
- **Node.js**: >= 20.0.0
- **pnpm**: >= 8.0.0
- **Docker**: >= 20.0.0
- **PostgreSQL**: >= 14.0

### 外部服务
- **Temporal Server**: 工作流编排
- **OpenRouter API**: AI 服务
- **Bunny Storage**: 对象存储（可选）

## 🛠️ 本地开发

### 1. 克隆和安装

```bash
# 克隆项目
git clone <repository-url>
cd rematrix-server

# 安装依赖
pnpm install

# 复制环境配置
cp .env.example .env
```

### 2. 环境配置

编辑 `.env` 文件：

```bash
# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/rematrix"

# Temporal 配置
TEMPORAL_ADDRESS="localhost:7233"
TEMPORAL_NAMESPACE="default"
TEMPORAL_TASK_QUEUE="rematrix-video"

# AI 服务配置
OPENROUTER_API_KEY="your-openrouter-api-key"
AI_MODEL="z-ai/glm-4.6"
AI_TEMPERATURE="0.2"

# 存储配置（可选）
BUNNY_STORAGE_ZONE="your-zone"
BUNNY_STORAGE_HOSTNAME="your-storage.hostname.com"
BUNNY_STORAGE_ACCESS_KEY="your-access-key"
BUNNY_PUBLIC_BASE_URL="https://your-cdn.b-cdn.net"

# 应用配置
PORT="3000"
NODE_ENV="development"
```

### 3. 启动服务

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

### 4. 验证安装

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

## 🚀 生产部署

### 1. 构建应用

```bash
# 构建生产版本
pnpm build

# 构建文档
cd docs && npm run build && cd ..
```

### 2. Docker 部署

创建 `docker-compose.prod.yml`：

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - TEMPORAL_ADDRESS=temporal:7233
    depends_on:
      - postgres
      - temporal
    restart: unless-stopped

  worker:
    build: .
    command: pnpm temporal:worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - TEMPORAL_ADDRESS=temporal:7233
    depends_on:
      - postgres
      - temporal
    restart: unless-stopped

  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=rematrix
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"
      - "8233:8233"
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - DB_HOST=postgres
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=temporal
    depends_on:
      - postgres
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./docs/dist:/usr/share/nginx/html/docs
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

### 3. Nginx 配置

创建 `nginx.conf`：

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # API 代理
        location /api/ {
            proxy_pass http://app/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # 文档站点
        location /docs {
            alias /usr/share/nginx/html/docs;
            index index.html;
            try_files $uri $uri/ /docs/index.html;
        }

        # SSE 支持
        location /jobs {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # SSE 特殊配置
            proxy_cache off;
            proxy_buffering off;
            proxy_set_header Connection '';
            proxy_http_version 1.1;
            chunked_transfer_encoding off;
        }
    }
}
```

### 4. 部署脚本

创建 `deploy.sh`：

```bash
#!/bin/bash

set -e

echo "🚀 开始部署 Rematrix Server..."

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
    echo "❌ 请设置 DATABASE_URL 环境变量"
    exit 1
fi

if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "❌ 请设置 OPENROUTER_API_KEY 环境变量"
    exit 1
fi

# 构建镜像
echo "📦 构建 Docker 镜像..."
docker build -t rematrix-server:latest .

# 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
docker run --rm \
  --network rematrix_default \
  -e DATABASE_URL="$DATABASE_URL" \
  rematrix-server:latest \
  pnpm prisma migrate deploy

# 启动服务
echo "🔄 启动服务..."
docker compose -f docker-compose.prod.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 健康检查
echo "🔍 执行健康检查..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ 部署成功！"
    echo "📖 文档地址: http://your-domain.com/docs"
    echo "🔧 API 地址: http://your-domain.com/api"
    echo "⏰ Temporal UI: http://your-domain.com:8233"
else
    echo "❌ 部署失败，请检查日志"
    docker compose -f docker-compose.prod.yml logs
    exit 1
fi
```

## 📚 文档维护

### 1. 更新文档

```bash
# 编辑文档
vim docs/api/jobs.md

# 重新构建
cd docs && npm run build

# 提交更改
git add docs/
git commit -m "更新 API 文档"
git push
```

### 2. 版本管理

```bash
# 创建文档版本
cd docs
git tag -a v1.0.0 -m "文档版本 1.0.0"
git push origin v1.0.0

# 生成变更日志
git log --oneline --since="1 month ago" docs/ > CHANGELOG.md
```

### 3. 自动化构建

在 `.github/workflows/docs.yml` 中：

```yaml
name: 文档构建和部署

on:
  push:
    branches: [main]
    paths: ['docs/**']

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: 设置 Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: 安装依赖
      run: pnpm install
    
    - name: 构建文档
      run: |
        cd docs
        npm run build
    
    - name: 部署到 GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./docs/dist
```

## 📊 监控和日志

### 1. 应用监控

```typescript
// src/monitoring/health.controller.ts
@Controller('health')
export class HealthController {
  @Get()
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version,
    };
  }

  @Get('detailed')
  async detailedCheck() {
    const [dbStatus, temporalStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkTemporal(),
    ]);

    return {
      status: dbStatus && temporalStatus ? 'ok' : 'error',
      services: {
        database: dbStatus ? 'ok' : 'error',
        temporal: temporalStatus ? 'ok' : 'error',
      },
    };
  }
}
```

### 2. 日志配置

```typescript
// src/logging/logger.config.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const loggerConfig = WinstonModule.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});
```

### 3. 性能监控

```typescript
// src/monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private metrics = {
    requests: 0,
    errors: 0,
    jobsCreated: 0,
    jobsCompleted: 0,
    averageResponseTime: 0,
  };

  incrementRequests() {
    this.metrics.requests++;
  }

  incrementErrors() {
    this.metrics.errors++;
  }

  incrementJobsCreated() {
    this.metrics.jobsCreated++;
  }

  incrementJobsCompleted() {
    this.metrics.jobsCompleted++;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
```

## 🔧 故障排查

### 常见问题

1. **Temporal 连接失败**
   ```bash
   # 检查 Temporal 服务状态
   docker compose ps temporal
   
   # 查看日志
   docker compose logs temporal
   ```

2. **数据库连接问题**
   ```bash
   # 测试数据库连接
   psql $DATABASE_URL -c "SELECT 1;"
   
   # 检查迁移状态
   pnpm prisma migrate status
   ```

3. **API 服务无响应**
   ```bash
   # 检查服务状态
   curl -I http://localhost:3000
   
   # 查看应用日志
   docker compose logs app
   ```

### 调试模式

```bash
# 启用调试日志
export DEBUG=rematrix:*
export LOG_LEVEL=debug

# 启动调试模式
pnpm start:dev --debug
```

## 🎯 生产优化

### 1. 性能优化

- **缓存策略**: Redis 缓存频繁查询的数据
- **连接池**: 数据库连接池优化
- **负载均衡**: 多实例部署和负载均衡
- **CDN**: 静态资源 CDN 加速

### 2. 安全加固

- **HTTPS**: 强制 HTTPS 连接
- **CORS**: 配置跨域策略
- **限流**: API 请求限流
- **认证**: JWT 或 OAuth 认证

### 3. 备份策略

```bash
# 数据库备份
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 文档备份
tar -czf docs_backup_$(date +%Y%m%d_%H%M%S).tar.gz docs/
```

---

🎉 **部署完成！** 

现在你的 Rematrix Server 和 Server Storybook 已经成功部署到生产环境。

如有问题，请查看故障排查部分或联系技术支持。
