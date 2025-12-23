# Change: 统一 startVideoGeneration 入参为 config 对象

## Why
当前 `startVideoGeneration` 方法在后端已经接受 `config` 参数，但前端仍在发送 `markdown` 字段，导致参数不一致。需要统一前后端的参数结构，确保数据传递的一致性和可维护性。

## What Changes
- **后端**: 修改 `CreateJobDto` 结构，明确字段定义
- **前端**: 修改 API 调用，使用 `content` 字段替代 `markdown` 字段
- **文档**: 更新相关 API 文档和类型定义

## Impact
- Affected specs: jobs
- Affected code: 
  - `src/modules/jobs/dto/create-job.dto.ts`
  - `app/src/pages/CourseCreate.tsx`
  - `app/src/api/types.ts` (可能需要)
