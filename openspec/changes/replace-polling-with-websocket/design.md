## Context
当前 Rematrix 系统使用轮询机制监听工作流状态：
- 前端每 1.5 秒调用 `GET /jobs/:id` 获取任务状态
- 后端服务使用 `setTimeout` 进行轮询等待（200ms 间隔）
- 聊天功能已使用 SSE，但工作流状态监听仍使用轮询

这种设计造成不必要的网络开销和服务器负载，且实时性不够理想。

## Goals / Non-Goals
- **Goals**: 
  - 提供工作流状态的实时推送
  - 减少不必要的网络请求
  - 保持现有 API 兼容性
  - 支持多客户端同时监听同一任务
  - 提供连接断开后的重连机制
- **Non-Goals**: 
  - 完全替换现有 REST API（仅补充 WebSocket）
  - 修改数据库架构
  - 改变 Temporal 工作流执行逻辑

## Decisions
- **Decision**: 使用 @nestjs/websockets 而非原生 ws 库
  - **Rationale**: 更好的 NestJS 集成，依赖注入支持，装饰器语法
  - **Alternatives considered**: 原生 ws、socket.io（过重）

- **Decision**: 基于 jobId 的房间管理
  - **Rationale**: 支持多客户端监听同一任务，便于广播
  - **Alternatives considered**: 直接连接、基于用户Id的房间

- **Decision**: 事件驱动的推送机制
  - **Rationale**: 与现有 Temporal 工作流集成，最小化侵入性
  - **Alternatives considered**: 定时推送、状态变更检测

## Risks / Trade-offs
- **Risk**: WebSocket 连接管理复杂性
  - **Mitigation**: 使用 NestJS 内置生命周期管理，添加心跳检测
- **Risk**: 网络代理兼容性问题
  - **Mitigation**: 提供降级到轮询的备选方案
- **Trade-off**: 内存使用增加（维护连接池）
  - **Mitigation**: 连接超时清理，限制单用户连接数

## Migration Plan
1. **Phase 1**: 添加 WebSocket 网关和基础架构
2. **Phase 2**: 集成工作流状态推送
3. **Phase 3**: 更新前端使用 WebSocket
4. **Phase 4**: 保留轮询作为备选方案

## Open Questions
- 如何处理 WebSocket 连接认证？
- 是否需要支持消息持久化？
- 如何监控 WebSocket 连接状态？
