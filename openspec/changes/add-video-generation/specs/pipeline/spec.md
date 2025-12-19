# Pipeline 能力规格

## ADDED Requirements

### Requirement: 阶段定义
系统 SHALL 定义以下生成阶段：PLAN、OUTLINE、STORYBOARD、NARRATION、PAGES、TTS、RENDER、MERGE、DONE。

#### Scenario: 阶段顺序执行
- **WHEN** Job 开始执行
- **THEN** 按顺序执行各阶段，每个阶段的输出作为下一阶段的输入

### Requirement: PLAN 阶段
系统 SHALL 在 PLAN 阶段解析 Markdown，生成整体工作计划。

#### Scenario: 生成工作计划
- **WHEN** 输入 Markdown 文档
- **THEN** 输出结构化计划，包含预估页数、时长、风格建议、用户确认问题

### Requirement: OUTLINE 阶段
系统 SHALL 在 OUTLINE 阶段生成文档大纲。

#### Scenario: 生成大纲
- **WHEN** 输入 Markdown 和已确认的计划
- **THEN** 输出章节结构、每章要点、预估时长

### Requirement: STORYBOARD 阶段
系统 SHALL 在 STORYBOARD 阶段生成分镜脚本。

#### Scenario: 生成分镜
- **WHEN** 输入大纲
- **THEN** 输出每页/镜头的画面描述、时长、字幕要点

### Requirement: NARRATION 阶段
系统 SHALL 在 NARRATION 阶段生成口播稿。

#### Scenario: 生成口播稿
- **WHEN** 输入分镜脚本
- **THEN** 输出每页的口播文本、重点强调词、禁用词

### Requirement: PAGES 阶段
系统 SHALL 在 PAGES 阶段生成视频页面 DSL。

#### Scenario: 生成页面 DSL
- **WHEN** 输入分镜和口播稿
- **THEN** 输出每页的布局、内容块、主题配置

### Requirement: TTS 阶段
系统 SHALL 在 TTS 阶段生成语音音频。

#### Scenario: 生成 TTS
- **WHEN** 输入口播稿
- **THEN** 输出每页的音频 URL、时长、可选的句级时间戳

### Requirement: RENDER 阶段
系统 SHALL 在 RENDER 阶段渲染视频页面。

#### Scenario: 渲染页面
- **WHEN** 输入页面 DSL
- **THEN** 输出每页的视频片段或图片序列

### Requirement: MERGE 阶段
系统 SHALL 在 MERGE 阶段合成最终视频。

#### Scenario: 合成视频
- **WHEN** 输入渲染片段和 TTS 音频
- **THEN** 输出带字幕的完整视频文件
