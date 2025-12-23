# Change: Remove NARRATION, TTS, RENDER, MERGE steps from video generation workflow

## Why
为了简化工作流程，直接从分镜脚本生成页面并组装成PDF，跳过语音生成和视频合成阶段，提高文档转换效率。

## What Changes
- **BREAKING**: 移除NARRATION、TTS、RENDER、MERGE步骤及其相关代码
- 修改工作流：PLAN → OUTLINE → STORYBOARD → PAGES → DONE
- 更新PAGES步骤，直接从STORYBOARD生成页面内容
- 添加PDF生成功能作为PAGES步骤的最终输出
- 移除所有音频、视频处理相关的依赖和配置

## Impact
- Affected specs: workflow-steps, video-generation
- Affected code: 
  - src/modules/workflow-steps/steps/narration.step.ts (删除)
  - src/modules/workflow-steps/steps/tts.step.ts (删除)
  - src/modules/workflow-steps/steps/render.step.ts (删除)
  - src/modules/workflow-steps/steps/merge.step.ts (删除)
  - src/modules/workflow-steps/steps/pages.step.ts (修改，添加PDF生成)
  - src/temporal/workflows/video-generation.workflow.ts (修改)
  - src/temporal/activities/video-generation.activities.ts (修改)
  - step-registry.service.ts (移除注册)
