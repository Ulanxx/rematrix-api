# 环境搭建指南

本指南将帮助您搭建 Rematrix Server 的完整开发环境。

## 📋 前置要求

### 基础环境
- **Node.js**: >= 20.0.0
- **pnpm**: >= 8.0.0
- **Docker**: >= 20.0.0
- **PostgreSQL**: >= 14.0

### 开发工具推荐
- **VS Code**: 推荐的代码编辑器
- **Git**: 版本控制工具
- **Postman**: API 测试工具

## 🚀 快速安装

### 1. 安装 Node.js 和 pnpm

```bash
# 安装 Node.js (推荐使用 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# 安装 pnpm
npm install -g pnpm
```

### 2. 安装 Docker

```bash
# macOS
brew install --cask docker

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker
```

### 3. 克隆项目

```bash
git clone <repository-url>
cd rematrix-server
```

## 🔧 环境配置

### 1. 安装项目依赖

```bash
# 安装主项目依赖
pnpm install

# 安装文档依赖
cd docs && pnpm install && cd ..
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量文件
nano .env
```

**必需的环境变量**：

```bash
# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/rematrix"

# Temporal 配置
TEMPORAL_ADDRESS="localhost:7233"
TEMPORAL_NAMESPACE="default"
TEMPORAL_TASK_QUEUE="rematrix-video"

# AI 服务配置
OPENROUTER_API_KEY="your-openrouter-api-key"
AI_MODEL="google/gemini-3.0-flash"
AI_TEMPERATURE="0.2"

# 应用配置
PORT="3000"
NODE_ENV="development"
```

**可选的环境变量**：

```bash
# 对象存储配置
BUNNY_STORAGE_ZONE="your-zone"
BUNNY_STORAGE_HOSTNAME="your-storage.hostname.com"
BUNNY_STORAGE_ACCESS_KEY="your-access-key"
BUNNY_PUBLIC_BASE_URL="https://your-cdn.b-cdn.net"

# 日志配置
LOG_LEVEL="info"
```

## 🗄️ 数据库设置

### 1. 使用 Docker 运行 PostgreSQL

```bash
# 启动 PostgreSQL 容器
docker run --name postgres-dev \
  -e POSTGRES_DB=rematrix \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:14

# 验证连接
docker exec -it postgres-dev psql -U postgres -d rematrix -c "SELECT 1;"
```

### 2. 运行数据库迁移

```bash
# 生成 Prisma 客户端
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate dev

# 查看数据库状态
pnpm prisma migrate status
```

## ⏰ Temporal 设置

### 1. 启动 Temporal Server

```bash
# 使用 Docker Compose 启动
docker compose -f temporal-docker-compose-min.yml up -d

# 验证 Temporal 服务
curl http://localhost:7233
```

### 2. 访问 Temporal UI

打开浏览器访问：http://localhost:8233

## 🚀 启动服务

### 1. 启动 API Server

```bash
# 开发模式启动
pnpm start:dev

# 或者使用调试模式
pnpm start:dev --debug
```

### 2. 启动 Temporal Worker

```bash
# 新开终端窗口
pnpm temporal:worker
```

### 3. 启动文档站点

```bash
# 新开终端窗口
cd docs
npm run dev
```

## ✅ 验证安装

### 1. 检查服务状态

```bash
# 检查 API 服务
curl http://localhost:3000

# 检查文档站点
curl http://localhost:5173

# 检查 Temporal UI
curl http://localhost:8233
```

### 2. 测试 API 功能

```bash
# 创建测试任务
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"config":{"markdown":"# 测试文档\n\n这是一个测试。"}}'

# 查询任务列表
curl http://localhost:3000/jobs
```

### 3. 验证工作流

```bash
# 获取任务 ID
JOB_ID=$(curl -s http://localhost:3000/jobs | jq -r '.jobs[0].id')

# 启动工作流
curl -X POST http://localhost:3000/jobs/$JOB_ID/run

# 查看任务状态
curl http://localhost:3000/jobs/$JOB_ID
```

## 🔧 开发工具配置

### VS Code 扩展推荐

创建 `.vscode/extensions.json`：

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "prisma.prisma",
    "ms-vscode.vscode-json"
  ]
}
```

### VS Code 设置

创建 `.vscode/settings.json`：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  }
}
```

### 调试配置

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/nest",
      "args": ["start", "--debug", "--watch"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

## 🐛 常见问题

### 1. 端口冲突

```bash
# 查看端口占用
lsof -i :3000
lsof -i :5173
lsof -i :8233

# 杀死占用进程
kill -9 <PID>
```

### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 状态
docker ps | grep postgres

# 查看数据库日志
docker logs postgres-dev

# 重启数据库
docker restart postgres-dev
```

### 3. Temporal 连接问题

```bash
# 检查 Temporal 服务
docker compose ps

# 重启 Temporal
docker compose restart temporal

# 查看 Temporal 日志
docker compose logs temporal
```

### 4. 依赖安装失败

```bash
# 清理缓存
pnpm store prune

# 重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## 📚 下一步

环境搭建完成后，您可以：

1. 📖 阅读 [快速开始指南](../quick-start.md)
2. 🔌 学习 [API 使用指南](./api-usage.md)
3. 🛠️ 了解 [调试技巧](./debugging.md)
4. 🚀 查看 [部署指南](../deployment.md)

---

🎉 **恭喜！** 您已经成功搭建了 Rematrix Server 的开发环境。

如果遇到问题，请查看 [常见问题](./faq.md) 或提交 Issue。
