# PromptOps 能力规格

## ADDED Requirements

### Requirement: 阶段级配置
系统 SHALL 支持按生成阶段配置 Prompt、模型与工具。

#### Scenario: 为单个阶段覆盖配置
- **WHEN** Job 配置覆盖了某个 stage 的 prompt/model/tools
- **THEN** 该 stage 执行时使用覆盖后的配置，不影响其他 stage

### Requirement: 配置可在运行时更新
系统 SHALL 支持在服务运行期间更新 PromptOps 配置，并在不重启服务的情况下生效。

#### Scenario: Admin 修改后快速生效
- **WHEN** 管理员通过 admin 接口更新某个 stage 的配置
- **THEN** 新配置在一个可控的短时间窗口内对后续执行生效

### Requirement: 配置存储在数据库
系统 SHALL 将 PromptOps 的 stage 配置与 prompt 版本存储在数据库中。

#### Scenario: 重启后配置仍存在
- **WHEN** 服务重启
- **THEN** PromptOps 配置从数据库恢复，行为与重启前一致

### Requirement: 管理接口
系统 SHALL 提供 admin 接口用于管理 stage 配置与 prompt 版本。

#### Scenario: 查看与发布配置
- **WHEN** 管理员查询某个 stage 的配置列表并选择发布版本
- **THEN** 系统将该版本标记为 active，后续执行使用 active 版本

### Requirement: Prompt 版本化
系统 SHALL 支持对 Prompt 进行版本化，并允许在执行时选择版本。

#### Scenario: 回滚 Prompt
- **WHEN** 将某 stage 的 promptVersion 切换为旧版本
- **THEN** 后续重试或重新运行使用旧版本提示词

### Requirement: LLM 调用栈统一
系统 SHALL 统一使用 Vercel AI SDK 通过 OpenRouter 调用模型。

#### Scenario: 禁用 LangChain
- **WHEN** 代码中存在 LangChain 的 LLM 调用实现
- **THEN** 在本能力落地时替换为 Vercel AI SDK + OpenRouter 的实现

### Requirement: 调用追溯
系统 SHALL 记录 LLM 调用的关键元信息（model、promptVersion、tools）以便追溯。

#### Scenario: 查询产物的生成来源
- **WHEN** 查询由 LLM 生成的 Artifact
- **THEN** 返回该 Artifact 对应的 model、promptVersion、tools 列表
