# Approvals 能力规格

## ADDED Requirements

### Requirement: 确认点定义
系统 SHALL 在以下阶段设置确认点：PLAN（计划确认）、NARRATION（口播稿确认）、PAGES（页面确认）。

#### Scenario: 到达确认点时暂停
- **WHEN** Job 执行到确认点阶段
- **THEN** 系统暂停执行，状态变为 WAITING_APPROVAL，创建 Approval 记录

### Requirement: 确认操作
系统 SHALL 支持用户确认（approve）或拒绝（reject）当前阶段的产物。

#### Scenario: 用户确认
- **WHEN** 用户调用 approve 接口，指定 stage 和可选的 artifactVersion
- **THEN** Approval 状态变为 APPROVED，Job 继续执行下一阶段

#### Scenario: 用户拒绝
- **WHEN** 用户调用 reject 接口并提供修改意见
- **THEN** Approval 状态变为 REJECTED，comment 记录修改意见

### Requirement: 修改后重新生成
系统 SHALL 支持用户修改产物后重新生成后续阶段。

#### Scenario: 修改口播稿后重新生成 TTS
- **WHEN** 用户修改 NARRATION 阶段的口播稿并确认
- **THEN** 系统使用新版本的口播稿重新生成 TTS

### Requirement: 跳过确认点
系统 SHALL 支持配置跳过某些确认点（自动确认）。

#### Scenario: 自动确认模式
- **WHEN** Job 配置了 autoApprove: ['PLAN', 'PAGES']
- **THEN** 这些阶段自动确认，不暂停等待用户
