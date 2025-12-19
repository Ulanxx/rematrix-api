# 实现任务清单

## 1. 基础设施搭建
- [ ] 1.1 安装依赖：`@ai-sdk/openai`, `ai`, `@temporalio/client`, `@temporalio/worker`, `@temporalio/workflow`
- [ ] 1.2 安装依赖：`playwright`, `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`
- [ ] 1.3 安装依赖：`@bunny.net/storage-sdk`
- [ ] 1.4 配置 Temporal 连接（Temporal Server 地址、Namespace、Task Queue）
- [ ] 1.5 创建 `src/modules/` 目录结构

## 2. 数据模型
- [ ] 2.1 选择数据库方案：naon(Postgres) + Prisma
- [ ] 2.2 定义 Job schema（id, userId, status, currentStage, stageStatus, config, createdAt, updatedAt）
- [ ] 2.3 定义 Artifact schema（id, jobId, stage, type, version, content, blobUrl, createdBy, createdAt）
- [ ] 2.4 定义 Approval schema（id, jobId, stage, status, comment, createdAt, updatedAt）
- [ ] 2.5 运行数据库迁移

## 3. 核心模块实现
- [ ] 3.1 实现 StorageModule（StorageProvider 接口 + Bunny Edge Storage 实现）
- [ ] 3.2 实现 LlmModule（Vercel AI SDK + OpenRouter 封装）
- [ ] 3.3 实现 JobsModule（JobsController + JobsService）
- [ ] 3.4 实现 ArtifactsModule（ArtifactsController + ArtifactsService）
- [ ] 3.5 实现 ApprovalsModule（ApprovalsController + ApprovalsService）

## 4. Pipeline 阶段实现
- [ ] 4.1 实现 PipelineModule（阶段编排逻辑）
- [ ] 4.2 实现 PLAN 阶段处理器（解析 Markdown，生成计划）
- [ ] 4.3 实现 OUTLINE 阶段处理器（生成大纲）
- [ ] 4.4 实现 STORYBOARD 阶段处理器（生成分镜）
- [ ] 4.5 实现 NARRATION 阶段处理器（生成口播稿）
- [ ] 4.6 实现 PAGES 阶段处理器（生成页面 DSL）

## 5. TTS 模块
- [ ] 5.1 定义 TtsProvider 接口
- [ ] 5.2 实现 listenhub TTS Provider
- [ ] 5.3 实现 TtsService（批量合成、结果存储）

## 6. 渲染模块
- [ ] 6.1 实现 RendererModule（Playwright 截图）
- [ ] 6.2 创建页面 HTML 模板
- [ ] 6.3 实现 renderToImage 方法

## 7. 视频模块
- [ ] 7.1 实现 VideoModule（FFmpeg 封装）
- [ ] 7.2 实现视频片段合成
- [ ] 7.3 实现音视频对齐
- [ ] 7.4 实现字幕生成（SRT/VTT）
- [ ] 7.5 实现字幕烧录

## 8. Temporal Worker
- [ ] 8.1 定义 Temporal Workflow（驱动 PLAN→...→DONE，遇到确认点等待 signal）
- [ ] 8.2 定义 Temporal Activities（每个阶段一个 activity：plan/outline/storyboard/narration/pages/tts/render/merge）
- [ ] 8.3 实现 Temporal Worker（注册 workflow + activities，配置 task queue）
- [ ] 8.4 实现确认点信号（approve/reject）与 Workflow 内部等待逻辑
- [ ] 8.5 实现重试策略与错误处理（activity retry、不可重试错误分类）

## 9. API 端点
- [ ] 9.1 POST /jobs - 创建任务
- [ ] 9.2 GET /jobs/:id - 获取任务状态
- [ ] 9.3 GET /jobs/:id/artifacts - 获取任务产物
- [ ] 9.4 PATCH /artifacts/:id - 编辑产物
- [ ] 9.5 POST /jobs/:id/approve - 确认阶段
- [ ] 9.6 POST /jobs/:id/run - 触发执行
- [ ] 9.7 POST /jobs/:id/cancel - 取消任务
- [ ] 9.8 GET /jobs/:id/output - 获取最终视频

## 10. 测试
- [ ] 10.1 LlmService 单元测试
- [ ] 10.2 Pipeline 阶段处理器单元测试
- [ ] 10.3 JobsService 集成测试
- [ ] 10.4 端到端测试（完整流程）

## 11. 文档
- [ ] 11.1 更新 README.md
- [ ] 11.2 编写 API 文档
- [ ] 11.3 编写环境变量配置说明
