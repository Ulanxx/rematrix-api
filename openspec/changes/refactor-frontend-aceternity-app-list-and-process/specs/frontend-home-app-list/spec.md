## ADDED Requirements

### Requirement: Home Displays App List
首页 MUST 移除联调/工具性内容，并展示“应用列表”。

#### Scenario: 首页不再展示联调入口
- **WHEN** 用户访问首页
- **THEN** 页面 SHALL 不展示以输入 `jobId` 为核心的联调表单内容

#### Scenario: 展示应用列表卡片
- **WHEN** 用户访问首页
- **THEN** 页面 SHALL 展示应用卡片列表
- **AND** 每个卡片 SHALL 展示应用名称与状态（至少包含：已完成、生成中）

### Requirement: Navigate To App Detail
用户从首页选择一个应用后 MUST 可以进入该应用的详情页。

#### Scenario: 点击卡片进入详情
- **WHEN** 用户点击任一应用卡片
- **THEN** 前端 SHALL 跳转到该应用详情页路由
