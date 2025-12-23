# 实现任务清单

## 1. 后端：补齐协作 API（最小可用）
- [x] 1.1 扩展 `POST /jobs`：支持接收课程配置字段（style/language），并写入 `job.config`
- [x] 1.2 增加 `POST /jobs/:id/reject`：向 Temporal workflow 发送 reject signal，并返回最新 job/approval（或超时返回 timeout 标记）
- [x] 1.3 扩展 Temporal workflow：支持在 PLAN/NARRATION/PAGES 三处等待确认（approve/reject）
- [x] 1.4 扩展 activities：当进入确认点时确保 `job.status=WAITING_APPROVAL`，并写入/更新 `approval(jobId, stage)`
- [x] 1.5 为前端联调补齐查询：明确 `GET /jobs/:id` 返回字段（currentStage/status/config），必要时增加 DTO/序列化

## 2. 前端：上传 md → 生成流程 UI（参考交互）
- [x] 2.1 新增“课程创建”页面：选择 `.md` 文件、读取内容、预览（只读）、填写课程配置
- [x] 2.2 创建 Job：调用 `POST /jobs`（body: markdown + config）并展示 jobId
- [x] 2.3 启动执行：调用 `POST /jobs/:id/run`，并跳转到“制作过程”页面
- [x] 2.4 制作过程页：轮询 `GET /jobs/:id` 与 `GET /jobs/:id/artifacts`，展示 stage 进度与产物列表
- [x] 2.5 确认面板：在 PLAN/NARRATION/PAGES 阶段提供 approve/reject（reject 支持填写 reason）
- [x] 2.6 产物编辑（模式 A 最小实现）：
  - 对 NARRATION/PAGES 允许在前端通过文本域编辑并提交到后端（需要后端 PATCH artifact 端点时再实现；若暂缺则先做 UI 与调用点预留）

## 3. 验证
- [x] 3.1 后端：增加至少 1 个 e2e 或集成测试覆盖 create/run/approve 的 happy path（可使用 Temporal stub 或本地 Temporal）
- [x] 3.2 前端：本地手工验证（上传 md → 创建 job → run → 生成 PLAN artifact → approve → 继续下一阶段）

## 4. 文档
- [x] 4.1 更新 `DEV_OVERVIEW_AND_FE_INTEGRATION.md`：补充上传 md 的前后端联调步骤与 API 示例
