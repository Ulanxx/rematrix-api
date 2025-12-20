# rematrix-server

Rematrix 的后端服务：基于 NestJS + Temporal 的「从 Markdown 生成视频」编排与任务系统。

当前主要流程：`PLAN → OUTLINE → NARRATION → PAGES → (RENDER → MERGE)`，其中 `PLAN / NARRATION / PAGES` 为需要人工确认的审批点（approve/reject）。

相关更详细的开发与联调说明见：`DEV_OVERVIEW_AND_FE_INTEGRATION.md`。

## 技术栈

- **API**：NestJS (TypeScript)
- **编排**：Temporal（Workflow/Activity + 本地 Temporal UI）
- **数据库**：Postgres（Prisma + Neon adapter）
- **渲染/处理**：Playwright、FFmpeg（用于后续/部分阶段）
- **对象存储（可选）**：Bunny Storage（用于 artifact JSON 上云并生成 `blobUrl`）

## 快速开始（本地跑通）

### 前置依赖

- Node.js（建议使用项目默认版本管理方式）
- pnpm
- Docker（用于启动 Temporal Server + UI）

### 1) 安装依赖

```bash
pnpm install
```

### 2) 配置环境变量

在根目录创建 `.env` 并填入配置。

必填：

- `DATABASE_URL`：Postgres 连接串

推荐：

- `PORT`：API 端口（默认 `3000`）
- `TEMPORAL_ADDRESS`：默认 `localhost:7233`
- `TEMPORAL_NAMESPACE`：默认 `default`
- `TEMPORAL_TASK_QUEUE`：默认 `rematrix-video`

可选（用于 Bunny 上传与 `blobUrl`）：

- `BUNNY_STORAGE_ZONE`
- `BUNNY_STORAGE_HOSTNAME`（例如 `uk.storage.bunnycdn.com`）
- `BUNNY_STORAGE_ACCESS_KEY`
- `BUNNY_PUBLIC_BASE_URL`（例如 `https://xxx.b-cdn.net`）

### 3) 启动 Temporal Server + UI

```bash
docker compose -f temporal-docker-compose-min.yml up
```

Temporal UI：

- http://localhost:8233

### 4) 首次安装 Playwright 浏览器（仅首次需要）

```bash
pnpm exec playwright install chromium
```

安装完成后如 worker 已在运行，需要重启 worker。

### 5) 启动 Temporal Worker

```bash
pnpm temporal:worker
```

### 6) 启动 API Server

```bash
pnpm start:dev
```

默认 API Base URL：

- http://localhost:3000

## 前端联调（可选）

前端在 `app/`（Vite）。

```bash
pnpm -C app dev
```

默认前端地址：

- http://localhost:5173

建议在前端配置：

- `VITE_API_BASE_URL=http://localhost:3000`

联调页面：

- `/course/create`：上传 `.md` 创建 Job 并运行
- `/jobs/:id/process`：制作过程页，轮询 job/artifacts 并在审批点进行 approve/reject
- `/apps/:jobId`：应用详情页（左侧 Process/物料素材，右侧 ChatBot）

## API 概览（常用）

- `POST /jobs`：创建 Job
- `GET /jobs`：列出 Job（用于前端首页应用列表）
- `POST /jobs/:id/run`：启动 workflow
- `GET /jobs/:id`：查询 Job 状态
- `POST /jobs/:id/approve`：通过某阶段（`stage=PLAN|NARRATION|PAGES`）
- `POST /jobs/:id/reject`：拒绝某阶段
- `GET /jobs/:jobId/artifacts?waitForStage=...&timeoutMs=...`：查询/等待产物
- `GET /jobs/:id/chat/sse?message=...`：ChatBot SSE（流式回复，使用 `Authorization: Bearer <token>`）

更完整的请求/响应示例请直接看：`DEV_OVERVIEW_AND_FE_INTEGRATION.md`。

## 常见问题排查

- **Temporal UI 打不开 / 500**
  - 确认 `docker compose -f temporal-docker-compose-min.yml up` 正常运行
  - UI：`http://localhost:8233`
- **Workflow 卡住不推进**
  - 先看 worker 日志是否在消费 task queue
  - 确认 `TEMPORAL_TASK_QUEUE=rematrix-video` 与 worker 输出一致
- **报 Playwright 缺 Chromium**
  - 执行 `pnpm exec playwright install chromium` 并重启 worker
- **artifact 的 `blobUrl` 为 null**
  - 说明 Bunny 上传失败但已降级写 DB（仍可用 `content` 预览）
  - 检查 Bunny 相关环境变量与 worker 日志

## 目录结构（节选）

- `src/`：NestJS 源码
- `src/temporal/`：Temporal workflow/worker/activity
- `prisma/`：Prisma schema / migrations
- `app/`：前端（Vite + React）
- `temporal-docker-compose-min.yml`：本地 Temporal Server + UI

## 相关文档

- `DEV_OVERVIEW_AND_FE_INTEGRATION.md`：开发概览 & 前端联调指南
