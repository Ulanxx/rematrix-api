# Design: 前端上传 Markdown 并驱动三段确认的视听课程生成流程

## Context
目标是让用户从前端上传 `.md` 文件开始，完成“创建任务 → 启动生成 → 三段确认（PLAN/NARRATION/PAGES）→ 生成最终产物（视听课程）”的闭环。

仓库现状：
- 后端已存在 `jobs/artifacts` 基础接口与 Temporal workflow（目前主要覆盖 PLAN 等待确认）。
- 前端已存在 artifact 列表/预览与 approve 联调页面，但缺少上传入口与“制作过程”编排 UI。

## Goals / Non-Goals

### Goals
- 提供前端上传 `.md` 文件并创建 Job 的用户路径。
- 按既定确认点（PLAN/NARRATION/PAGES）实现“暂停等待 → 用户确认/拒绝 → 继续执行”。
- 模式 A：Markdown 仅作为输入；后续修改/确认以结构化 Artifact 为主。
- MVP 以轮询实现进度更新（可复用 `waitForStage`）。

### Non-Goals
- 实时推送（SSE/WebSocket）。
- 完整的结构化编辑器（MVP 先用文本域/JSON 编辑）。
- 权限/多租户/计费。

## Key Decisions

### 1) 前后端交互模型
- **Job** 代表一次课程生成任务，`job.config` 保存输入 markdown 与课程配置。
- **Artifact** 代表每阶段产物（PLAN/NARRATION/PAGES 等），可版本化。
- **Approval** 代表确认闸门，按 `(jobId, stage)` 唯一。

### 2) API 约定（MVP）
- `POST /jobs`
  - body: `{ markdown: string, style?: string, language?: string }`
  - resp: `{ jobId: string }`
- `POST /jobs/:id/run`
  - resp: `{ workflowId: string, runId: string }`
- `POST /jobs/:id/approve`
  - body: `{ stage: 'PLAN'|'NARRATION'|'PAGES' }`
  - resp: `{ ok: true, job?: Job, approval?: Approval, timeout?: boolean }`
- `POST /jobs/:id/reject`
  - body: `{ stage: 'PLAN'|'NARRATION'|'PAGES', reason?: string }`
  - resp: `{ ok: true, job?: Job, approval?: Approval, timeout?: boolean }`
- `GET /jobs/:id`
  - resp: `Job`
- `GET /jobs/:id/artifacts?waitForStage=...&timeoutMs=...`
  - resp: `{ artifacts: Artifact[], timeout: boolean }`

### 3) 前端页面流（参考交互）
- **课程素材页**：上传 `.md` → 预览 → 填写课程配置 → 创建 Job
- **制作过程页**：
  - 展示 pipeline 阶段（PLAN/OUTLINE/STORYBOARD/NARRATION/PAGES/TTS/RENDER/MERGE/DONE）
  - 在 WAITING_APPROVAL 且 stage ∈ {PLAN,NARRATION,PAGES} 时显示确认面板
  - 展示当前 stage 的 artifact（默认最新版本）与历史版本
- **产物预览页**：复用现有 `ArtifactPreview`，补齐 reject/编辑入口（MVP 可隐藏编辑）。

### 4) Temporal 侧确认语义
- Workflow 在进入确认点阶段后：
  - 写入/更新 `approval(jobId, stage)=PENDING`
  - 将 `job.status=WAITING_APPROVAL`
  - `condition` 等待 `approveStage` 或 `rejectStage` signal
- approve：
  - `approval=APPROVED`
  - `job.status=RUNNING`
  - 推进到下一阶段
- reject：
  - `approval=REJECTED`，记录 `comment=reason`
  - 保持/回到 `WAITING_APPROVAL`
  - 根据阶段策略决定：
    - MVP：停留在同一阶段，等待用户修改 artifact 或再次 approve

## Risks / Trade-offs
- 轮询会产生额外请求量：MVP 先接受；后续可引入 SSE。
- NARRATION/PAGES 的“修改后再生成”依赖 artifact 编辑接口与活动重跑策略：MVP 先约定行为并在 apply 阶段逐步实现。

## Open Questions
- NARRATION/PAGES 的编辑格式：MVP 采用“可编辑 JSON 文本”还是“Markdown 模板化文本”。
