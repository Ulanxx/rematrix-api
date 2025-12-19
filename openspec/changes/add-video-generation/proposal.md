# Change: 添加 Markdown 转视频生成服务

## Why
用户需要将 Markdown 文档转换为带字幕的讲解视频。这是一个复杂的多阶段工作流，需要 LLM 解析、TTS 生成、视频渲染等多个步骤，且需要支持用户在关键节点确认/修改物料。

## What Changes
- **BREAKING**: 新增完整的视频生成服务架构
- 新增 Job/Artifact/Approval 三层数据模型
- 新增 8 个核心模块：jobs, artifacts, approvals, llm, pipeline, tts, renderer, video
- 集成 Vercel AI SDK + OpenRouter 进行 LLM 调用
- 集成 Temporal 进行工作流编排
- 新增对象存储抽象（Bunny Edge Storage）

## Impact
- Affected specs: jobs, artifacts, approvals, llm, pipeline, tts, renderer, video, storage
- Affected code: 新增 `src/modules/` 目录结构，新增数据库 schema，新增队列 worker
