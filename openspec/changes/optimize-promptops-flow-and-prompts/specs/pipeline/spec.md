# Pipeline 能力规格（增量）

## MODIFIED Requirements

### Requirement: 阶段可重试且幂等
系统 SHALL 支持同一 stage 因错误重试或被重复触发时的幂等执行。

#### Scenario: 基于质量闭环的可控重试
- **WHEN** 某 stage 输出未通过 schema 校验，或质量检测判定需要修复
- **THEN** 系统在可控次数内进行重试/修复，并记录每次尝试的配置与输入摘要
