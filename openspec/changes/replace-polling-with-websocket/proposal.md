# Change: Replace Polling with WebSocket for Workflow Monitoring

## Why
当前系统使用轮询方式监听工作流状态，前端每 1.5 秒调用一次接口获取任务状态，后端服务使用 setTimeout 进行轮询等待。这种方式造成不必要的网络开销和服务器负载，且实时性不够好。WebSocket 双向通信可以提供更好的实时性和效率。

## What Changes
- 添加 WebSocket 支持到 NestJS 后端
- 实现工作流状态的实时推送机制
- 替换前端轮询逻辑为 WebSocket 连接
- 保持现有 API 接口兼容性
- 添加 WebSocket 连接管理和错误处理

## Impact
- **Affected specs**: workflow-engine, jobs
- **Affected code**: 
  - `src/modules/workflow-engine/` - 添加 WebSocket 网关
  - `src/modules/jobs/` - 集成 WebSocket 事件推送
  - `app/src/pages/JobProcess.tsx` - 替换轮询为 WebSocket
  - `package.json` - 添加 @nestjs/websockets 依赖
