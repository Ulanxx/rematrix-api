## Context
Rematrix 的核心链路是 “Markdown → PLAN → OUTLINE → STORYBOARD → NARRATION → PAGES → TTS → RENDER → MERGE → DONE”。
项目已具备 PromptOps（stage 级配置与发布 active）与结构化输出（schema）基础，但缺少一套跨 stage 的 prompt 工程标准与质量闭环。

参考 `forma-prompt` 的经验，本设计侧重三个维度：
- 统一 Prompt 的“结构与约束”表达方式，让 prompt 可读、可审查、可迁移。
- 让结构化输出不仅是“schema 校验”，还能形成“检测→修复→再校验”的闭环。
- 将可追溯信息标准化，减少排障成本。

## Goals / Non-Goals
- Goals:
  - 提供一套 Rematrix Prompt 标准模板（推荐结构）与强约束（必须项/禁止项）。
  - 定义质量检测与修复执行的 prompt 类型与触发策略（作为 PromptOps 元信息/重试策略的一部分）。
  - 统一变量占位规范，避免与下游渲染/模板冲突。
  - 提升可追溯性：能够回答“某个 Artifact 是用什么 prompt/model/schema 生成的、输入是什么”。
- Non-Goals:
  - 本变更不实现新的前端页面/交互（PromptOps UI 已存在）。
  - 本变更不强制引入新的 LLM Provider；仍沿用 Vercel AI SDK + OpenRouter。

## Decisions
- Decision: Prompt 标准采用“分段模板 + 强约束清单”
  - Why: 便于 code review 与快速定位问题；将经验固化为可复用结构。
- Decision: 变量占位统一使用尖括号形式（如 `<markdown>`、`<job_config>`）
  - Why: 避免 `{{...}}` 与前端/后端模板引擎冲突；与 forma-prompt 的安全建议一致。
- Decision: 质量闭环拆成两类 prompt
  - `QA/Check`: 输入上游产物与约束，输出结构化问题清单与修复计划。
  - `Repair/Apply`: 以 QA 的修复计划为优先指令，输出修复后的结构化产物。
  - Why: 将“发现问题”和“执行修改”分离，便于控制变更幅度（最小改动）并保留审计记录。
- Decision: PromptOps meta 增强以表达“输出契约与修复策略”
  - Why: 让运行时可根据配置决定是否启用自动修复、最大修复次数、以及每次修复的上下文。

## Risks / Trade-offs
- 风险: Prompt 约束过强导致模型输出更保守/更短
  - 缓解: 提供默认模板与可调参数（temperature/maxTokens），并按 stage 区分“确定性任务/创造性任务”。
- 风险: 自动修复可能引入不可控改动
  - 缓解: Repair prompt 必须遵守“最小改动”原则；并记录 repairAttempt 与差异摘要（实现阶段）。

## Open Questions
- 是否需要分层配置（global → tenant → job）？当前先按 global(active) + job override。
- 质量检测/修复是否对所有 stage 默认开启，还是仅对 PAGES / NARRATION 等高风险产物开启？
