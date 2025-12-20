## Context
当前前端工程位于 `app/`，已集成 Tailwind 与 `shadcn/ui`，用于最小联调与 PromptOps 配置。
本 change 目标是将 UI 基座升级为 Aceternity，并围绕“应用”交互重构首页与详情页信息架构。

## Goals / Non-Goals
- Goals:
  - 全局采用 Aceternity UI 作为组件与视觉基座
  - 首页展示应用列表并可进入详情
  - 详情页能展示生成的 Process，左侧物料/素材、右侧 ChatBot
- Non-Goals:
  - 不在本 change 内定义/实现复杂的权限体系
  - 不强制引入重型状态管理与数据缓存框架（除非需求明确）

## Decisions
- Decision: UI 基座以 Aceternity 为主，Tailwind 继续作为样式原语
  - Why: Aceternity 本身与 Tailwind 生态高度兼容；可在不推翻工程化的情况下升级视觉与交互
- Decision: 对“基础 UI 组件”采用薄封装策略（例如 `app/src/components/ui/*`）
  - Why: 减少页面直接绑定第三方实现，便于后续替换/统一风格
- Decision: 首页/详情页数据优先复用现有 `/jobs/:jobId/...` 相关 API
  - Why: 当前后端已经围绕 job/artifact 运作；短期内可将“应用”视为 job 的展示层抽象

## Risks / Trade-offs
- 风险: “应用”与 `job` 的概念边界不清晰，可能导致路由与数据模型频繁调整
  - 缓解: 本 change 将“应用详情”先以 `jobId` 驱动，若未来引入 `appId` 再做二次抽象
- 风险: Aceternity 与现有 `shadcn/ui` 风格混用造成不一致
  - 缓解: 以页面为单位逐步替换，优先覆盖 AppShell/Home/Detail 的核心路径

## Migration Plan
- 第一步：接入 Aceternity 并建立基础组件封装
- 第二步：重构首页为应用列表
- 第三步：新增/重构详情页布局与 ChatBot

## Open Questions
- 应用列表数据来源与字段（是否需要后端新增“应用列表”接口）
- ChatBot 的对接协议：同步请求/流式、是否关联 PromptOps stage
