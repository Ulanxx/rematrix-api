# Jobs（上传 Markdown 驱动课程生成）能力规格变更

## ADDED Requirements

### Requirement: 从上传 Markdown 创建 Job
系统 SHALL 支持从前端上传的 Markdown 内容创建视频生成任务，并返回可用于后续操作的 `jobId`。

#### Scenario: 成功创建任务（上传 md）
- **WHEN** 用户在前端上传有效的 `.md` 文件并提交
- **THEN** 前端将文件内容作为 `markdown` 发送到 `POST /jobs`
- **AND** 后端创建新的 Job 实例并返回 `jobId`

#### Scenario: 创建任务时携带课程配置
- **WHEN** 用户在创建 Job 时指定 `style`、`language`
- **THEN** 后端 SHALL 将这些字段保存到 `job.config`

### Requirement: 启动 Job 执行
系统 SHALL 支持显式触发 Job 执行，并启动 Temporal workflow。

#### Scenario: 启动执行
- **WHEN** 前端调用 `POST /jobs/:id/run`
- **THEN** 后端 SHALL 启动对应的 workflow 并返回 `workflowId/runId`（或等价信息）

### Requirement: Job 状态与阶段可查询
系统 SHALL 支持前端查询 Job 的状态与当前阶段，以驱动制作过程页的进度展示。

#### Scenario: 查询任务进度
- **WHEN** 前端调用 `GET /jobs/:id`
- **THEN** 后端 SHALL 返回 `status`、`currentStage`、以及必要的错误信息（如有）
