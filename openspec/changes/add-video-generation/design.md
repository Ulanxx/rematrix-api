# Design: Markdown 转视频生成服务

## Context
用户上传 Markdown 文档，系统自动解析并生成带字幕的讲解视频。这是一个长耗时、多阶段、需要人工确认的工作流。

**约束**：
- 必须支持用户在关键节点确认/修改物料
- 每个阶段必须幂等、可重试
- 大文件需要对象存储

## Goals / Non-Goals

**Goals**：
- 实现完整的 Markdown → 视频 生成流水线
- 支持用户在 PLAN、NARRATION、PAGES 三个阶段确认/修改
- 使用 Vercel AI SDK + OpenRouter 进行 LLM 调用
- 使用 Temporal 进行工作流编排（支持长任务、可暂停等待用户确认）
- MVP 阶段使用 Playwright 截图 + FFmpeg 合成视频

**Non-Goals**：
- 不实现前端 UI（仅后端 API）
- 不实现用户认证（后续迭代）
- 不实现多租户隔离（后续迭代）
- 不使用 Remotion（MVP 阶段）

## Decisions

### 1. 架构模式：Job/Artifact/Approval 三层抽象

**决策**：使用三层数据模型管理工作流
- **Job**：任务实例，包含状态、进度、当前阶段
- **Artifact**：每个阶段的产物，支持版本号
- **Approval**：确认点，控制工作流推进

**理由**：
- 解耦任务状态与产物数据
- 支持产物版本化（用户修改后生成新版本）
- 确认点作为"闸门"控制流程推进

**替代方案**：
- 单一 Job 表存储所有数据 → 数据结构复杂，难以扩展
- 使用 Temporal workflow → 上手成本高，MVP 阶段过度设计

### 2. LLM 调用：Vercel AI SDK + OpenRouter

**决策**：使用 Vercel AI SDK 封装 LLM 调用，通过 OpenRouter 路由到不同模型

**理由**：
- Vercel AI SDK 提供统一的流式输出、结构化输出能力
- OpenRouter 支持多模型切换，便于成本优化
- 与现有 LangChain 代码可共存

**配置**：
```typescript
import { createOpenAI } from '@ai-sdk/openai';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

### 3. 工作流编排：Temporal

**决策**：使用 Temporal 管理长任务工作流，Workflow 负责阶段推进与等待确认，Activity 负责实际耗时执行。

**理由**：
- 原生支持长工作流、可恢复与重试策略
- 原生支持“等待外部信号/人工确认”这种交互式闸门
- Workflow 状态可持久化，避免应用重启导致任务丢失

**替代方案**：
- BullMQ + Redis → 需要自己实现确认等待/恢复语义，复杂度会逐渐上升
- 直接 async/await → 不支持持久化、重试

### 4. 视频渲染：Playwright 截图 + FFmpeg

**决策**：MVP 阶段使用 Playwright 截图生成帧，FFmpeg 合成视频

**理由**：
- 实现简单，快速验证
- 不需要额外的渲染服务
- 后续可升级到 Remotion

**流程**：
1. 生成页面 HTML（基于 DSL）
2. Playwright 截图每页 → PNG
3. FFmpeg 拼接 PNG + 音频 → MP4
4. FFmpeg 烧录字幕 → 最终视频

### 5. TTS 供应商：listenhub

**决策**：TTS 使用 listenhub；代码层仍保留 `TtsProvider` 抽象以便未来切换。

**理由**：
- 不同供应商价格/质量差异大
- 便于切换和 A/B 测试

```typescript
interface TtsProvider {
  synthesize(text: string, options: TtsOptions): Promise<TtsResult>;
}

interface TtsResult {
  audioUrl: string;
  durationMs: number;
}
```

### 6. 存储：Bunny Edge Storage

 **决策**：定义 `StorageProvider` 接口，默认实现使用 Bunny Edge Storage（HTTP API/SDK）。

 **理由**：
 - 统一使用 Bunny Storage Zone，简化部署与成本
 - 通过 hostname 区分存储区域（例如 uk.storage.bunnycdn.com）

 **配置**：
 - `BUNNY_STORAGE_ZONE`（Storage Zone Name，例如 rematrix-server）
 - `BUNNY_STORAGE_HOSTNAME`（例如 uk.storage.bunnycdn.com）
 - `BUNNY_STORAGE_ACCESS_KEY`（Storage Zone Password，用作 AccessKey）

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| LLM 输出不稳定 | 使用 Zod schema 校验 + 自动修复重试 |
| TTS 成本高 | 按需生成，支持用户修改后再生成 |
| 视频渲染慢 | 异步队列处理，支持进度查询 |
| 大文件存储 | 使用对象存储，设置过期策略 |

## Migration Plan

1. 安装依赖：`@ai-sdk/openai`, `ai`, `@temporalio/client`, `@temporalio/worker`, `@temporalio/workflow`, `playwright`, `fluent-ffmpeg`
2. 配置 Temporal（开发环境与生产环境连接方式）
3. 创建数据库 schema（Job/Artifact/Approval），数据库使用 naon(Postgres)
4. 实现核心模块（按 tasks.md 顺序）
5. 集成测试
6. 部署

## Open Questions

1. **数据库选型**：使用 naon(Postgres)。
2. **TTS 供应商**：使用 listenhub。
3. **字幕精度**：sentence-level。
