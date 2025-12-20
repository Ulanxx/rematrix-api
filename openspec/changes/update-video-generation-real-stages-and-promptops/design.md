## Context
现有视频生成 workflow 已具备审批闸门与渲染/合成能力，但多个上游阶段仍为 mock 输出，且提示词与模型选择缺乏工程化管理。

## Goals / Non-Goals
- Goals:
  - 将关键阶段改为真实生成，并保证幂等/可重试。
  - 引入可配置的 Prompt/模型/工具系统，按 stage 独立配置与版本化。
- Non-Goals:
  - 本变更不定义前端 UI。

## Decisions
- Decision: 引入 PromptOps（按 stage 的 step-spec）
  - Why: 将 prompt/模型/工具从代码中剥离，支持逐步调参与快速回滚。
- Decision: 配置载体采用 DB + Admin 管理
  - Why: 需要支持热更新，并允许通过 admin 平台在线优化每个 stage 的 prompt/模型参数。
- Decision: 热更新策略采用“读缓存 + 版本号失效”
  - Why: 减少每次 stage 执行的 DB 压力，同时保证 admin 修改后能快速生效。
- Decision: LLM 统一使用 Vercel AI SDK + OpenRouter
  - Why: 降低维护成本，避免 LangChain 与 Vercel AI SDK 双栈并行。
- Decision: tools 先采用最小可行方案
  - Why: 当前工具范围不明确，先保留可扩展配置结构；默认不启用 tool-calling，仅允许后续以白名单方式逐步开放。

## Risks / Trade-offs
- 风险: 配置过于灵活导致不可控
  - 缓解: 定义强 schema 校验、提供默认模板、限制可用工具集合。

## Open Questions
- 是否需要“按租户/用户/项目”分层配置（例如 global → tenant → job 覆盖）？
- 热更新时效目标：admin 修改后期望在多少秒内生效？
