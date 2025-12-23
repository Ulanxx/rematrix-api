# Change: 前端上传 Markdown 并驱动三段确认的视听课程生成流程

## Why
当前前端仅支持通过手动输入 jobId 进行产物预览与 approve 联调，缺少“上传 md → 创建任务 → 启动生成 → 三段确认（PLAN/NARRATION/PAGES）→ 输出课程成品”的端到端用户路径，导致前后端协作成本高、用户无法自助完成生成。

## What Changes
- 新增前端“上传 Markdown 文件”入口：选择 `.md` 文件并预览内容、填写课程配置、提交创建 Job。
- 新增前端“生成流程”页面：展示阶段进度、待确认清单与确认面板（参考你提供的交互）。
- 在现有后端 API 基础上补齐/规范：
  - 创建 Job 时支持接收 `markdown`（来源于上传文件内容）与课程配置
  - 启动执行：`POST /jobs/:id/run`
  - 三个确认点：`POST /jobs/:id/approve` 与 `POST /jobs/:id/reject`
  - 产物获取：`GET /jobs/:id/artifacts`（支持按 stage 等待）
- 明确“模式 A”协作规则：Markdown 仅做输入；后续用户编辑/确认以结构化产物（Artifact）为主。

## Impact
- Affected specs:
  - jobs
  - approvals
  - artifacts
  - frontend-course-flow
- Affected code:
  - `app/` 前端新增页面与 API 调用
  - `src/modules/jobs` 可能新增/补齐 reject、run 后状态返回等端点
  - `src/temporal/workflows/video-generation.workflow.ts` 从仅 PLAN 扩展到 PLAN/NARRATION/PAGES 三处等待确认

## Out of Scope
- 账号体系/权限模型（仍沿用现有 JWT 注入机制）
- 课程成品“发布/分享/导出”平台化能力（本次只保证可生成并预览最终产物链接）
- 实时推送（SSE/WebSocket）；本次以轮询为主

## Open Questions
- 课程配置字段的最小集合：建议先支持`style`、`language`，其余后续迭代。
- NARRATION/PAGES 的“修改入口”在 MVP 阶段采用“编辑 JSON/Markdown 文本域”还是“结构化表单编辑器”。
