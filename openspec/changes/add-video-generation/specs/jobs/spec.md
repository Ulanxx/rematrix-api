# Jobs 能力规格

## ADDED Requirements

### Requirement: Job 创建
系统 SHALL 支持通过上传 Markdown 文档创建视频生成任务。

#### Scenario: 成功创建任务
- **WHEN** 用户提交有效的 Markdown 文档
- **THEN** 系统创建新的 Job 实例，状态为 DRAFT，返回 jobId

#### Scenario: 创建任务时指定选项
- **WHEN** 用户提交 Markdown 并指定 style、language 等选项
- **THEN** 系统将选项保存到 Job 配置中

### Requirement: Job 状态管理
系统 SHALL 维护 Job 的状态机，支持以下状态：DRAFT、WAITING_APPROVAL、RUNNING、FAILED、COMPLETED、CANCELED。

#### Scenario: 状态流转
- **WHEN** Job 完成当前阶段且遇到确认点
- **THEN** 状态变为 WAITING_APPROVAL

#### Scenario: 用户确认后继续
- **WHEN** 用户调用 approve 接口
- **THEN** 状态变为 RUNNING，继续执行下一阶段

### Requirement: Job 阶段追踪
系统 SHALL 追踪 Job 当前所处的阶段：PLAN、OUTLINE、STORYBOARD、NARRATION、PAGES、TTS、RENDER、MERGE、DONE。

#### Scenario: 查询任务进度
- **WHEN** 用户查询 Job 状态
- **THEN** 返回当前阶段、各阶段状态、进度百分比、错误信息（如有）

### Requirement: Job 取消
系统 SHALL 支持取消正在进行的任务。

#### Scenario: 取消运行中的任务
- **WHEN** 用户调用 cancel 接口
- **THEN** 状态变为 CANCELED，队列中的待处理任务被移除

### Requirement: Job 重试
系统 SHALL 支持从失败阶段重试任务。

#### Scenario: 重试失败的任务
- **WHEN** Job 状态为 FAILED 且用户调用 retry 接口
- **THEN** 从失败的阶段重新开始执行
