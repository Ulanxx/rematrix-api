# 实现任务清单

## 1. Prompt 工程规范
- [x] 1.1 定义 Rematrix Prompt 标准模板（role/context/instructions/variables/output_schema/constraints/examples/self_checklist）。
- [x] 1.2 定义变量占位与禁用语法规则（例如禁止 `{{...}}`；统一 `<...>`）。
- [x] 1.3 为每个 stage 提供默认 prompt 模板（PLAN/OUTLINE/STORYBOARD/NARRATION/PAGES/TTS），并在 PromptOps bootstrap 时写入。

## 2. 输出契约与质量闭环
- [x] 2.1 PromptOps 配置扩展：支持声明 `outputContract`（schemaVersion/schemaRef）与 `qualityLoop`（checkPromptId/repairPromptId/maxAttempts/enable）。
- [x] 2.2 LLM 调用封装增强：按配置执行“生成→校验→（可选）检测→修复→再校验”的闭环。
- [x] 2.3 定义 QA(Check) 与 Repair(Apply) 的标准 schema（问题清单、策略、修复指令）。

## 3. 可追溯性
- [x] 3.1 Artifact 元信息字段补齐：inputsHash、promptVersion、schemaVersion、model、temperature、tools、repairAttempt、qualityStatus。
- [x] 3.2 提供查询能力：按 job/stage 查看产物的生成来源与修复历史（admin API）。

## 4. 验证
- [x] 4.1 单元测试：变量替换与 prompt 渲染、schema 校验、质量闭环重试策略。
- [x] 4.2 集成测试：跑通 PLAN→...→MERGE，并覆盖至少一次“检测→修复”分支。
