# 实现任务清单

## 1. 阶段真实化
- [x] 1.1 梳理现有 Temporal workflow/activities 的阶段列表，与 pipeline 规格对齐（补齐 STORYBOARD/TTS 或明确 MVP 范围）。
- [x] 1.2 实现 PLAN 阶段真实生成（基于 Markdown + 结构化 schema），写入 Artifact 并创建 Approval。
- [x] 1.3 实现 OUTLINE 阶段真实生成（依赖 PLAN），写入 Artifact。
- [x] 1.4 实现 STORYBOARD 阶段真实生成（依赖 OUTLINE），写入 Artifact。
- [x] 1.5 实现 NARRATION 阶段真实生成（依赖 STORYBOARD），写入 Artifact 并创建 Approval。
- [x] 1.6 实现 PAGES 阶段真实生成（依赖 STORYBOARD+NARRATION），写入 Artifact 并创建 Approval。
- [x] 1.7 实现 TTS 阶段（依赖 NARRATION），生成音频并写入 Artifact（blobUrl + 时长）。
- [x] 1.8 调整 workflow：阶段顺序、确认点等待逻辑、错误重试与幂等策略。

## 2. Prompt 工程化（PromptOps）
- [x] 2.1 定义 step 配置模型：按 stage 配置 prompt 模板、模型、工具列表、温度、输出 schema、重试策略。
- [x] 2.2 实现配置加载与覆盖：提供默认配置，并支持按 job 覆盖指定 stage 的配置。
- [x] 2.3 LLM 调用统一封装：支持结构化输出校验与自动修复重试；记录每次调用的 prompt 版本与模型。
- [ ] 2.4 Artifact 元信息：为 LLM 生成类 Artifact 增加可追溯字段（promptVersion/model/tools/inputsHash）。

## 3. 验证
- [ ] 3.1 单元测试：PromptOps 配置解析、LLM 输出校验与重试逻辑。
- [x] 3.2 集成测试：跑通 PLAN→...→MERGE 主链路（可跳过确认点）。
- [ ] 3.3 本地最小验证：启动 temporal（docker compose）+ worker + api server；创建 job；依次发送 approveStage 信号通过 PLAN/NARRATION/PAGES；确认 MERGE 产出 Artifact(VIDEO)。
