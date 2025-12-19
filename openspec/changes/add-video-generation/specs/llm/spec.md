# LLM 能力规格

## ADDED Requirements

### Requirement: LLM 服务封装
系统 SHALL 提供统一的 LLM 调用服务，封装 Vercel AI SDK + OpenRouter。

#### Scenario: 调用 LLM 生成结构化输出
- **WHEN** 调用 LlmService.generate 并传入 prompt 和 Zod schema
- **THEN** 返回符合 schema 的结构化 JSON 数据

#### Scenario: 流式输出
- **WHEN** 调用 LlmService.stream 并传入 prompt
- **THEN** 返回 AsyncIterable，逐步输出生成内容

### Requirement: 结构化输出校验
系统 SHALL 使用 Zod schema 校验 LLM 输出，失败时自动重试。

#### Scenario: 输出校验失败自动修复
- **WHEN** LLM 输出不符合 schema
- **THEN** 系统发送纠错提示让模型修正，最多重试 3 次

#### Scenario: 多次重试仍失败
- **WHEN** 重试 3 次后仍不符合 schema
- **THEN** 抛出 LlmValidationError，记录原始输出用于调试

### Requirement: 模型配置
系统 SHALL 支持通过配置切换不同的 LLM 模型。

#### Scenario: 使用 OpenRouter 路由
- **WHEN** 配置 OPENROUTER_API_KEY 和 model 名称
- **THEN** 请求通过 OpenRouter 路由到指定模型

### Requirement: 提示词版本管理
系统 SHALL 记录每次 LLM 调用使用的提示词版本。

#### Scenario: 追溯生成来源
- **WHEN** 查询 Artifact 的生成历史
- **THEN** 可以看到使用的 prompt 版本和模型名称
