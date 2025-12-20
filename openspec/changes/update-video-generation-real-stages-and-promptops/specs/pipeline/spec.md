# Pipeline 能力规格（增量）

## MODIFIED Requirements

### Requirement: 阶段定义
系统 SHALL 定义以下生成阶段：PLAN、OUTLINE、STORYBOARD、NARRATION、PAGES、TTS、RENDER、MERGE、DONE。

#### Scenario: 阶段顺序执行
- **WHEN** Job 开始执行
- **THEN** 按顺序执行各阶段，每个阶段的输出作为下一阶段的输入

#### Scenario: 阶段可重试且幂等
- **WHEN** 同一 stage 因错误重试或被重复触发
- **THEN** 系统基于最新输入与配置生成一致输出，并创建新版本 Artifact 或复用已存在的等价结果
