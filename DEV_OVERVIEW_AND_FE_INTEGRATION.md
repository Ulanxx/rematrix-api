# rematrix-server 开发概览 & 前端联调指南

本文档描述当前阶段（PLAN -> OUTLINE）的后端能力、开发运行方式、环境变量约定、以及前端联调接口与推荐流程。

## 1. 当前阶段能力概览

### 1.1 端到端流程（已实现）

- 输入：Markdown 文本
- Temporal workflow 编排：
  - `PLAN` 阶段：生成 plan artifact（JSON）并创建 approval(PENDING)，Job 进入 `WAITING_APPROVAL`
  - 等待前端（或调用方）发 `approveStage(PLAN)` signal
  - 通过后：
    - 将 approval 标记为 APPROVED
    - Job 进入 RUNNING
    - 推进到 `OUTLINE`
  - `OUTLINE` 阶段：生成 outline artifact（JSON）
    - 同步上传到 Bunny Storage（如环境变量齐全）
    - 将 URL 写入 `Artifact.blobUrl`

### 1.2 当前输出物（Artifacts）

- `PLAN`：JSON（估算页数/时长/风格/问题列表）
- `OUTLINE`：JSON（标题/分段/要点） + `blobUrl`（Bunny 公网/存储 URL）

### 1.3 当前后端模块

- **PrismaModule**：Neon Postgres 连接（Prisma 7 + Neon adapter）
- **TemporalModule**：Temporal client（启动 workflow / signal）
- **JobsModule**：对外提供最小 job API（create/run/approve/get）
- **ArtifactsModule**：对外提供 artifacts 查询，并支持等待某阶段产物出现
- **StorageModule**：Bunny Storage 上传/删除封装（目前 Temporal activity 直接复用 util）

### 1.4 关键数据模型（Prisma）

- `Job`
  - `id`
  - `status`: `DRAFT | WAITING_APPROVAL | RUNNING | ...`
  - `currentStage`: `PLAN | OUTLINE | ...`
  - `config`: JSON（目前保存 markdown 等参数）
  - `error`: string?（预留）
- `Artifact`
  - `jobId`
  - `stage`
  - `type`: `JSON`（当前）
  - `version`
  - `content`: JSON
  - `blobUrl`: string?（Bunny URL）
- `Approval`
  - `(jobId, stage)` 唯一
  - `status`: `PENDING | APPROVED | REJECTED`
  - `comment`: string?

## 2. 本地开发运行方式

### 2.1 必要服务

- Temporal Server（本地 docker compose）
- Temporal Worker（Node 进程）
- Nest API Server（Node 进程）

### 2.2 启动命令（推荐顺序）

1) 启动 Temporal Server（最小 compose）

```bash
docker compose -f temporal-docker-compose-min.yml up
```

2) 启动 Temporal Worker

```bash
pnpm temporal:worker
```

Worker 启动时会打印 Bunny 环境变量摘要（便于确认 worker 已加载 .env）：

- `hostname / zone / keyPrefix / publicBase`。

3) 启动 Nest Server

```bash
pnpm start:dev
```

默认端口来自 `.env` 的 `PORT`（目前为 3000）。

## 3. 环境变量（.env）

### 3.1 数据库

- `DATABASE_URL`：Neon Postgres 连接串

### 3.2 Temporal

（可选，默认可不填）

- `TEMPORAL_ADDRESS`（默认 `localhost:7233`）
- `TEMPORAL_NAMESPACE`（默认 `default`）
- `TEMPORAL_TASK_QUEUE`（默认 `rematrix-video`）

### 3.3 Bunny Storage

- `BUNNY_STORAGE_ZONE`：Storage Zone 名称
- `BUNNY_STORAGE_HOSTNAME`：如 `uk.storage.bunnycdn.com`
- `BUNNY_STORAGE_ACCESS_KEY`：Storage API Key
- `BUNNY_PUBLIC_BASE_URL`（推荐）：对外访问的 CDN base url
  - 例如：`https://rematrix-ai.b-cdn.net`

说明：
- `blobUrl` 会优先写 `BUNNY_PUBLIC_BASE_URL` 组装出的 URL；若未设置则回退为 storageUrl。

## 4. 前端联调指南

### 4.1 基础约定

- Base URL：`http://localhost:3000`
- Job ID：后端返回的 UUID
- Workflow ID：`video-generation-${jobId}`（后端内部约定）

### 4.2 API 列表

#### 4.2.1 创建 Job

- **POST** `/jobs`

Request:

```json
{
  "markdown": "# Title\n\nHello",
  "targetDurationSec": 60,
  "style": "default",
  "language": "zh"
}
```

Response:

```json
{
  "jobId": "<uuid>"
}
```

#### 4.2.2 启动 workflow

- **POST** `/jobs/:id/run`

Response:

```json
{
  "workflowId": "video-generation-<jobId>",
  "runId": "<temporal-run-id>"
}
```

#### 4.2.3 查询 Job

- **GET** `/jobs/:id`

Response（示例）：

```json
{
  "id": "<jobId>",
  "status": "WAITING_APPROVAL",
  "currentStage": "PLAN",
  "config": {
    "markdown": "..."
  }
}
```

#### 4.2.4 通过当前阶段（approve）

- **POST** `/jobs/:id/approve`

Request:

```json
{
  "stage": "PLAN"
}
```

Response（会尽量等待 DB 状态推进，避免前端读到旧状态）：

```json
{
  "ok": true,
  "job": { "id": "...", "status": "RUNNING", "currentStage": "OUTLINE" },
  "approval": { "stage": "PLAN", "status": "APPROVED" }
}
```

#### 4.2.5 查询 artifacts（支持等待）

- **GET** `/jobs/:jobId/artifacts`

可选 query：
- `waitForStage=OUTLINE`：等待某阶段 artifact 出现
- `timeoutMs=20000`：等待超时时间

Response:

```json
{
  "artifacts": [
    {
      "stage": "PLAN",
      "type": "JSON",
      "version": 1,
      "content": { "...": "..." },
      "blobUrl": null
    },
    {
      "stage": "OUTLINE",
      "type": "JSON",
      "version": 1,
      "content": { "...": "..." },
      "blobUrl": "https://rematrix-ai.b-cdn.net/jobs/<jobId>/artifacts/OUTLINE/v1.json"
    }
  ],
  "timeout": false
}
```

### 4.3 推荐联调流程（前端）

1) `POST /jobs` 创建 job，保存 `jobId`
2) `POST /jobs/:id/run` 启动 workflow
3) 轮询 / 查询：
   - `GET /jobs/:id` 看 `status/currentStage`
   - `GET /jobs/:id/artifacts?waitForStage=PLAN&timeoutMs=...`（可选）拿到 PLAN artifact
4) 用户在前端确认 plan 后：
   - `POST /jobs/:id/approve`（stage=PLAN）
5) 获取 OUTLINE：
   - `GET /jobs/:id/artifacts?waitForStage=OUTLINE&timeoutMs=20000`
   - 读取 `OUTLINE` artifact 的 `content` 或通过 `blobUrl` 拉取 JSON（更贴近后续大文件场景）

### 4.4 常见问题排查

- **approve 后立刻查 artifacts 没看到 OUTLINE**
  - 使用 `waitForStage=OUTLINE&timeoutMs=...`

- **blobUrl 为 null**
  - 说明 Bunny 上传失败但已降级写库（仍有 `content`）
  - 检查 worker 启动日志中 bunny 配置摘要是否正确
  - 查看 worker 输出的 `[bunny] upload outline failed ...`

- **Temporal activity 报错 / 阶段推进失败**
  - 优先看 worker 日志
  - 当前 `markStageApproved/Rejected` 已使用 `upsert`，可避免 approve 过早导致记录不存在

## 5. 当前边界（未实现）

- STORYBOARD 阶段
- narration / TTS
- video pages / renderer
- export video
- 取消/重试/失败恢复策略（更细粒度）
