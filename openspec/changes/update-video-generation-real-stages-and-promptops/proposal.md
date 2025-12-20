# Change: 将视频生成阶段改为真实实现并引入 Prompt 工程化

## Why
当前 Temporal activities 中多个阶段仍是硬编码 mock 输出，无法满足真实“Markdown → 视频”生产需求；同时 LLM 调用缺少可追溯的提示词/模型/工具配置与版本记录，难以迭代与排错。

## What Changes
- 将 PLAN/OUTLINE/NARRATION/PAGES 等阶段从 mock 输出改为真实生成，并对齐 pipeline 规格补齐缺失阶段（如 STORYBOARD、TTS）。
- 引入 Prompt 工程化能力：每个阶段的 Prompt、模型、工具可单独配置与版本化；产物记录生成元信息（prompt 版本、模型、工具）。

## Impact
- Affected specs: pipeline, llm, promptops
- Affected code: Temporal workflow/activities、LLM 调用封装、阶段处理器与配置加载
