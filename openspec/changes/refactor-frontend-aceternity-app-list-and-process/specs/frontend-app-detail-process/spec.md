## ADDED Requirements

### Requirement: App Detail Shows Process
应用详情页 SHALL 展示该应用生成的 Process（用于表达生成链路与当前进度）。

#### Scenario: 展示 Process 概览
- **WHEN** 用户进入某个应用详情页
- **THEN** 页面 SHALL 展示 Process 的最小可用视图（例如阶段列表/步骤流/当前阶段）

### Requirement: Detail Layout Material And ChatBot
应用详情页 MUST 使用左右分栏布局：左侧展示物料与素材，右侧展示 ChatBot。

#### Scenario: 左右布局
- **WHEN** 用户进入某个应用详情页
- **THEN** 页面 SHALL 渲染左右分栏布局
- **AND** 左侧 SHALL 展示物料/素材区域
- **AND** 右侧 SHALL 展示 ChatBot 区域

### Requirement: ChatBot Minimal Interaction
详情页的 ChatBot MUST 支持最小对话交互（消息列表 + 输入 + 发送）。

#### Scenario: 用户发送消息
- **WHEN** 用户在 ChatBot 输入框输入文本并点击发送
- **THEN** 界面 SHALL 将该消息追加到消息列表中
- **AND** 系统 SHOULD 预留一个可替换的后端调用点用于生成回复
