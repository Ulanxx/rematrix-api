## Context
Rematrix Server 是一个基于 NestJS + Temporal 的视频生成系统，目前缺乏完整的文档体系。开发者和维护者需要深入理解：
- API 接口的详细功能和使用方法
- 复杂的 Temporal 工作流编排逻辑
- AI 集成和提示词优化机制
- 审批流程和状态管理

当前项目虽然有 README 和开发文档，但缺乏系统性的、可交互的技术文档。

## Goals / Non-Goals
- Goals: 
  - 创建全面的 Server 端技术文档
  - 提供可交互的 API 调试界面
  - 梳理清晰的业务流程和架构图
  - 补充关键代码块的详细注释
  - 建立文档维护和更新机制
- Non-Goals:
  - 不修改现有业务逻辑
  - 不创建新的 API 接口
  - 不改变项目架构

## Decisions
- Decision: 使用 Markdown + VitePress 创建静态文档站点
  - 理由: 轻量级、易于维护、支持 Vue 组件交互
  - 替代方案: Storybook（更适合 UI 组件）、Docusaurus（配置复杂）

- Decision: 文档结构按功能模块组织
  - API 参考（按 Controller 分类）
  - 架构设计（NestJS + Temporal + AI）
  - 业务流程（视频生成工作流）
  - 开发指南（环境搭建、调试、部署）

- Decision: 代码注释采用 JSDoc 格式
  - 理由: TypeScript 原生支持，可生成类型提示
  - 工具: TypeDoc 自动生成 API 文档

## Risks / Trade-offs
- [Risk] 文档维护成本高 → Mitigation: 自动化脚本 + CI/CD 集成
- [Risk] 文档与代码不同步 → Mitigation: Git hooks + 类型检查
- [Trade-off] 详细程度 vs 维护成本 → 平衡点：核心模块详细，辅助模块概要

## Migration Plan
1. 创建文档目录结构 (`docs/`)
2. 配置 VitePress 构建环境
3. 编写核心模块文档
4. 添加代码注释和 JSDoc
5. 集成到 CI/CD 流程
6. 部署到静态托管服务

## Open Questions
- 文档是否需要多语言支持？
- 是否需要版本化文档管理？
- 是否需要用户反馈和评论系统？
