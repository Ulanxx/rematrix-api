# Project Context

## Purpose
Rematrix Server - 一个基于 NestJS 的后端服务，用于将 Markdown 文档转换为带字幕的讲解视频。

核心功能：
- 解析 Markdown 文档，生成工作计划
- 拆解文档生成大纲、分镜脚本、口播稿
- 生成视频页面、TTS 音频
- 合成最终带字幕的视频

## Tech Stack
- **Runtime**: Node.js >= 20
- **Framework**: NestJS 11
- **Language**: TypeScript 5.7
- **AI/LLM**: Vercel AI SDK + OpenRouter（计划中）, LangChain/LangGraph（现有）
- **Validation**: Zod
- **Testing**: Jest
- **Code Style**: Prettier + ESLint

## Project Conventions

### Code Style
- 使用 Prettier 格式化代码
- ESLint 进行代码检查
- 文件命名：kebab-case
- 类命名：PascalCase
- 变量/函数：camelCase

### Architecture Patterns
- NestJS 模块化架构（Module/Controller/Service）
- 依赖注入
- 队列驱动的长任务处理（计划使用 BullMQ）
- Job/Artifact/Approval 三层抽象用于工作流管理

### Testing Strategy
- 单元测试：Jest
- E2E 测试：Supertest
- 测试文件命名：`*.spec.ts`

### Git Workflow
- 使用中文 commit message
- 功能分支开发

## Domain Context
- **Job**: 一次"从 Markdown 到视频"的整体任务实例
- **Artifact**: 每个阶段的产物（大纲、分镜、口播稿、页面、音频、视频）
- **Approval**: 阶段性确认点，用户可在此修改/确认物料
- **Stage**: PLAN → OUTLINE → STORYBOARD → NARRATION → PAGES → TTS → RENDER → MERGE → DONE

## Important Constraints
- 长任务需要支持暂停/恢复/用户确认
- 每个 stage 必须幂等、可重试
- 大文件（音频/视频）需要对象存储

## External Dependencies
- **OpenRouter**: LLM 路由服务（baseURL: https://openrouter.ai/api/v1）
- **TTS Provider**: 待定（OpenAI/ElevenLabs/火山等）
- **Storage**: 待定（S3/R2/MinIO）
- **Queue**: BullMQ + Redis（计划中）
