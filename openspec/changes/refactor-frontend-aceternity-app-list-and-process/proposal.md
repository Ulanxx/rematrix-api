# Change: 前端基于 Aceternity 重构（首页应用列表 + 详情页 Process/ChatBot）

## Why
当前前端工程已基于 Tailwind + `shadcn/ui` 实现最小可用的联调页面，但：
- UI 风格不统一、组件体系需要升级为 Aceternity（https://ui.aceternity.com/）作为全局基座
- 首页仍包含联调/工具性入口，不符合产品化展示需求
- 缺少一个面向“应用”的详情页，用于展示生成的 Process、物料/素材，并提供 ChatBot 交互

## What Changes
- 全局以 Aceternity 组件风格作为 UI 基座，梳理并替换关键页面与组件（必要时保留 Tailwind 与少量自定义样式）
- 首页移除联调相关内容，改为展示“应用列表”（包含状态：已完成/生成中），点击进入详情页
- 新增/重构详情页：展示生成的 Process，布局为左侧物料与素材、右侧 ChatBot

## Impact
- Affected specs:
  - frontend-ui-foundation
  - frontend-home-app-list
  - frontend-app-detail-process
- Affected code:
  - `app/src/components/**`
  - `app/src/pages/**`
  - `app/src/App.tsx`（路由）
  - `app/package.json`（依赖：Aceternity 相关组件/依赖）

## Out of Scope
- 后端数据模型/接口的大改动（仅在缺失关键接口时提出最小必要增补）
- 复杂的实时流式对话/多会话管理（除非明确要求）

## Open Questions
- “应用列表”的数据来源：是否已有后端接口？若无，列表是否可先用静态/Mock（仅用于 UI）？
- 详情页的标识：应用 ID 是 `jobId` 还是独立 `appId`？（当前前端已有 `/jobs/:jobId/...` 路由）
- ChatBot 的后端对接形态：是复用 PromptOps/LLM 接口，还是临时仅做 UI 占位？
