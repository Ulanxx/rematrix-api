# Change: 优化全链路生成流程与 PromptOps 提示词工程

## Why
当前项目已具备 PromptOps（按 stage 配置 prompt/model/schema）与视频生成 pipeline，但 Prompt 仍缺少一套统一的“输出契约 + 变量约定 + 质量闭环（检测/修复）”规范，导致：
- 调参与排错依赖人工经验，缺少可复用模板与自查清单
- 不同 stage 的 prompt 结构不一致，难以协作与迭代
- 结构化输出虽有 schema，但缺少系统级的“生成→校验→修复”闭环策略定义（例如超长、字段缺失、内容不一致）

本变更参考 `/Users/ulanxx/yd_workspace/forma-prompt` 的 Prompt 工程化实践，补齐一套可落地到 Rematrix 的 Prompt 规范与流程。

## What Changes
- 定义 Rematrix Prompt 标准模板：统一 prompt 分段结构、变量占位规范、禁止项与语言/专有名词规则。
- 强化结构化输出契约：要求所有 LLM 生成类 stage 明确输出 schema（Zod/JSON Schema/TS Interface 三选一），并在 PromptOps 中显式存档。
- 引入质量闭环能力（检测/修复）：为关键产物（大纲/分镜/口播/页面数据）定义“质量检测”与“修复执行”两类 prompt 形态，作为可选的重试策略/自动修复策略。
- 明确可追溯元信息范围：为每次 LLM 生成记录 inputsHash、promptVersion、model、temperature、schemaVersion、repairAttempt 等，便于回放与对比。

## Impact
- Affected specs: promptops, pipeline
- Affected code (implementation stage): PromptOps 配置/加载、LLM 调用封装、各 stage prompt 模板与默认配置、Artifact 元信息字段与查询接口
