# Renderer 能力规格

## ADDED Requirements

### Requirement: 页面渲染
系统 SHALL 支持将页面 DSL 渲染为图片或视频片段。

#### Scenario: 渲染为图片
- **WHEN** 调用 RendererService.renderToImage 并传入页面 DSL
- **THEN** 使用 Playwright 截图，返回 PNG 图片 URL

#### Scenario: 渲染为视频片段
- **WHEN** 调用 RendererService.renderToVideo 并传入页面 DSL 和时长
- **THEN** 生成指定时长的视频片段

### Requirement: 页面模板
系统 SHALL 支持多种页面模板/主题。

#### Scenario: 使用指定模板
- **WHEN** 页面 DSL 指定 template 字段
- **THEN** 使用对应模板渲染页面

### Requirement: 动态内容
系统 SHALL 支持在页面中渲染动态内容（文本、图表、代码块）。

#### Scenario: 渲染代码块
- **WHEN** 页面 DSL 包含 code 类型的 block
- **THEN** 使用语法高亮渲染代码

#### Scenario: 渲染图表
- **WHEN** 页面 DSL 包含 chart 类型的 block
- **THEN** 渲染对应的图表
