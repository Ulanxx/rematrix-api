# rematrix-server 开发概览 & 前端联调指南

本文档描述当前阶段（PLAN -> OUTLINE -> NARRATION -> PAGES）的后端能力、开发运行方式、环境变量约定、以及前端联调接口与推荐流程。

## 1. 当前阶段能力概览

### 1.1 端到端流程（已实现）

- 输入：Markdown 文本
- Temporal workflow 编排：
  - `PLAN` 阶段：生成 plan artifact（JSON）并创建 approval(PENDING)，Job 进入 `WAITING_APPROVAL`
  - 等待前端（或调用方）发 `approveStage(PLAN)` 或 `rejectStage(PLAN)` signal
  - `OUTLINE` 阶段：生成 outline artifact（JSON）
    - 同步上传到 Bunny Storage（如环境变量齐全）
    - 将 URL 写入 `Artifact.blobUrl`
  - `NARRATION` 阶段：生成 narration artifact（JSON）并创建 approval(PENDING)，Job 进入 `WAITING_APPROVAL`
  - 等待前端（或调用方）发 `approveStage(NARRATION)` 或 `rejectStage(NARRATION)` signal
  - `PAGES` 阶段：生成 pages artifact（JSON）并创建 approval(PENDING)，Job 进入 `WAITING_APPROVAL`
  - 等待前端（或调用方）发 `approveStage(PAGES)` 或 `rejectStage(PAGES)` signal
  - `DONE`：当前 MVP 直接标记 Job 为 `COMPLETED`（后续会扩展到 TTS/RENDER/MERGE）

### 1.2 当前输出物（Artifacts）

- `PLAN`：JSON（估算页数/时长/风格/问题列表）
- `OUTLINE`：JSON（标题/分段/要点） + `blobUrl`（Bunny 公网/存储 URL）
- `NARRATION`：JSON（按页口播稿）
- `PAGES`：JSON（页面/主题 DSL 的最小结构）

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

#### 4.2.6 拒绝当前阶段（reject）

- **POST** `/jobs/:id/reject`

Request:

```json
{
  "stage": "PLAN",
  "reason": "希望更偏技术讲解"
}
```

Response（会尽量等待 DB 状态更新，若超时则返回 timeout=true）：

```json
{
  "ok": true,
  "job": { "id": "...", "status": "WAITING_APPROVAL", "currentStage": "PLAN" },
  "approval": { "stage": "PLAN", "status": "REJECTED", "comment": "..." },
  "timeout": false
}
```

### 4.3 推荐联调流程（前端）

1) `POST /jobs` 创建 job，保存 `jobId`
2) `POST /jobs/:id/run` 启动 workflow
3) 轮询 / 查询：
   - `GET /jobs/:id` 看 `status/currentStage`
   - `GET /jobs/:id/artifacts?waitForStage=PLAN&timeoutMs=...`（可选）拿到 PLAN artifact
4) 用户在前端确认/拒绝：
   - `POST /jobs/:id/approve`（stage=PLAN/NARRATION/PAGES）
   - `POST /jobs/:id/reject`（stage=PLAN/NARRATION/PAGES, reason 可选）
5) 产物获取：
   - `GET /jobs/:id/artifacts?waitForStage=OUTLINE|NARRATION|PAGES&timeoutMs=20000`
   - 读取 artifact 的 `content` 或通过 `blobUrl` 拉取 JSON

### 4.5 前端页面联调（新）

- `/course/create`：上传 `.md` 文件并创建 Job，点击“创建并开始执行”后自动跳转到制作过程页
- `/jobs/:id/process`：制作过程页，轮询 job/artifacts，并在 PLAN/NARRATION/PAGES 阶段提供 approve/reject 面板

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

## 6. 端到端联调与调试指南（推荐）

本节提供一条“能跑起来”的最短路径，并附带常见故障定位方法。

### 6.1 启动顺序（建议严格按顺序）

1) 启动 Temporal Server + Web UI

```bash
docker compose -f temporal-docker-compose-min.yml up
```

Web UI：

- http://localhost:8233

2) 安装 Playwright 浏览器（首次需要）

```bash
pnpm exec playwright install chromium
```

3) 启动 Temporal Worker

```bash
pnpm temporal:worker
```

4) 启动 Nest API Server

```bash
pnpm start:dev
```

5) 启动前端（Vite）

```bash
pnpm -C app dev
```

前端：

- http://localhost:5173

### 6.2 最短联调路径（从 0 到生成视频）

1) 打开前端：`/course/create`
2) 上传 `.md` 并点击“创建并开始执行”
3) 进入 `/jobs/:id/process`
4) 在确认点依次 **Approve**：
   - `PLAN`
   - `NARRATION`
   - `PAGES`
5) 通过 `PAGES` 后，Workflow 会继续执行 `RENDER → MERGE`（无 TTS 版本）
6) 最终视频：
   - 在 `/jobs/:id/process` 与 `/jobs/:id/artifacts` 页面置顶展示 `MERGE/VIDEO`
   - 点击预览或下载

### 6.3 如何在 Temporal Web UI 里看执行过程

1) 打开 http://localhost:8233
2) 使用 WorkflowId 搜索：

- `video-generation-<jobId>`

3) 进入详情页后重点看：

- **History**：信号、Activity 执行/重试、失败原因
- **Pending Activities**：当前卡在哪个 activity
- **Task Queue**：是否是 `rematrix-video`

### 6.4 常见故障与快速定位

#### A) Temporal Web UI 打不开/500

- **现象**：打开 `http://localhost:8233` 500，或 Network 中 `/api/v1/cluster-info` 503
- **原因**：`temporal-web` 没连上 `temporal:7233`
- **处理**：确保 compose 中 `temporal-web` 使用 `TEMPORAL_ADDRESS=temporal:7233`，并重启容器：

```bash
docker compose -f temporal-docker-compose-min.yml up -d --force-recreate temporal-web
```

#### B) Workflow failed：Playwright 浏览器缺失

- **现象**：worker 日志出现
  - `browserType.launch: Executable doesn't exist ...`
- **原因**：Playwright 刚安装/升级但本机未下载 Chromium
- **处理**：

```bash
pnpm exec playwright install chromium
```

安装后需要**重启 worker**。

#### C) 前端请求 /jobs 卡住 或 CORS

- **现象**：浏览器 preflight 204，但 POST pending/被拦截
- **原因**：后端未启用 CORS 或端口/baseUrl 不一致
- **处理**：
  - 后端已默认开启 CORS；确认前端 `VITE_API_BASE_URL=http://localhost:3000`
  - 确认 Nest 监听端口为 3000（或你的 `PORT`）

#### D) Bunny 上传失败（但流程仍可继续）

- **现象**：worker 日志出现 `[bunny] upload ... failed`，artifact 的 `blobUrl` 为 `null`
- **原因**：Bunny 环境变量不正确或网络问题
- **处理**：
  - `content` 仍会写入 DB，前端预览会自动回退到 DB content
  - 检查 worker 启动日志里打印的 bunny 配置摘要

#### E) Worker 不消费任务 / 阶段不推进

- **现象**：Temporal Web UI 里 workflow 卡住，activities 不执行
- **原因**：
  - worker 未启动
  - `TEMPORAL_TASK_QUEUE` 不一致（应为 `rematrix-video`）
- **处理**：
  - 确认 worker 输出：`taskQueue=rematrix-video`
  - 在 Web UI 里查看 Task Queue

#### F) DB 连接问题

- **现象**：后端接口 pending 或抛错，Prisma 报连接异常
- **原因**：`DATABASE_URL` 不可用
- **处理**：
  - 确认 `.env` 配置正确
  - 后端启动时若 Prisma 连接失败会直接报错

### 6.5 快速验证清单（建议照着勾）

- [ ] `docker compose -f temporal-docker-compose-min.yml up` 后 8233 可访问
- [ ] `pnpm temporal:worker` 正常运行，且 taskQueue 为 `rematrix-video`
- [ ] `pnpm start:dev` 后 API 可访问 `GET /jobs/:id`
- [ ] 前端 `/course/create` 可创建并 run
- [ ] `PLAN/NARRATION/PAGES` 可 approve/reject
- [ ] `PAGES` approve 后生成 `MERGE/VIDEO`，前端可播放/下载

## 5. 当前边界（未实现）

- STORYBOARD 阶段
- narration / TTS
- video pages / renderer
- export video
- 取消/重试/失败恢复策略（更细粒度）
