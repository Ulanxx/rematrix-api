# PromptOps 能力规格（增量）

## ADDED Requirements

### Requirement: Prompt 标准模板
系统 SHALL 为每个 stage 的 prompt 提供统一的推荐结构（例如 role/context/instructions/variables/output_schema/constraints/examples/self_checklist），并允许按 stage 覆盖。

#### Scenario: 使用统一模板管理不同 stage
- **WHEN** 管理员在 PromptOps 中查看不同 stage 的 prompt
- **THEN** prompt 结构保持一致，便于 review、调参与协作

### Requirement: 变量占位规范
系统 SHALL 规定 Prompt 中的变量占位符语法，并禁止与下游渲染冲突的语法（例如禁止 `{{...}}`）。

#### Scenario: 避免模板语法冲突
- **WHEN** prompt 内容需要引用输入变量（如 markdown、上游 artifact、用户补充要求）
- **THEN** 必须使用统一语法（例如 `<markdown>` 形式），且不出现 `{{...}}`

### Requirement: 质量闭环配置
系统 SHALL 支持为 stage 配置质量闭环策略（检测 prompt 与修复 prompt、最大修复次数、启用开关）。

#### Scenario: 启用自动检测与修复
- **WHEN** 某 stage 的生成输出通过 schema 校验但存在业务质量问题（例如内容过长、字段缺失、结构不一致）
- **THEN** 系统按配置执行检测与修复，并在达到最大次数后停止并返回可追溯错误

## MODIFIED Requirements

### Requirement: 调用追溯
系统 SHALL 记录 LLM 调用的关键元信息以便追溯。

#### Scenario: 查询产物的生成来源与修复历史
- **WHEN** 查询由 LLM 生成的 Artifact
- **THEN** 返回该 Artifact 对应的 model、promptVersion、schemaVersion、tools、inputsHash 与 repairAttempt
