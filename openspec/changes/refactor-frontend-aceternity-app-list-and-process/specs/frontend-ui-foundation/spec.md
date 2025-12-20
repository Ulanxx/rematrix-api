## ADDED Requirements

### Requirement: Aceternity UI Foundation
前端应用 MUST 以 Aceternity（https://ui.aceternity.com/）作为全局 UI 风格与组件能力基座。

#### Scenario: Aceternity 组件可用
- **WHEN** 开发者启动前端应用并访问任意核心页面（例如首页）
- **THEN** 页面 SHALL 使用至少一个 Aceternity 组件/模式完成渲染

#### Scenario: 关键页面风格一致
- **WHEN** 用户访问首页与详情页
- **THEN** 两个页面 SHALL 呈现一致的视觉风格（按钮、卡片、字体与间距策略）

### Requirement: UI Component Abstraction
前端应用 SHALL 提供一层薄封装的 UI 组件入口（例如 `app/src/components/ui/*` 或等价结构），以避免页面直接强耦合到第三方组件实现。

#### Scenario: 页面仅使用内部 UI 入口
- **WHEN** 开发者检查首页与详情页的组件引用
- **THEN** 页面 SHOULD 优先引用内部 UI 组件入口而非直接引用第三方组件实现
