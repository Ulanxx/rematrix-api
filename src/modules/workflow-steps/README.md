# Workflow Steps 模块化架构

这个模块实现了视频生成流水线的模块化 Step 架构，每个工作流阶段都被封装为独立的、可配置的 Step 定义。

## 概述

### 主要特性

- **模块化设计**: 每个工作流阶段（PLAN、OUTLINE、STORYBOARD 等）都是独立的 Step 定义
- **统一接口**: 所有 Step 都遵循 `StepDefinition` 接口，提供一致的配置和执行方式
- **类型安全**: 使用 TypeScript 和 Zod 提供完整的类型验证
- **依赖管理**: 自动验证和管理 Step 之间的依赖关系
- **可扩展性**: 易于添加新的工作流阶段或修改现有阶段

### 架构组件

1. **StepDefinition 接口**: 定义 Step 的标准结构和配置
2. **StepRegistry 服务**: 注册和管理所有 Step 定义
3. **StepExecutor 服务**: 提供统一的 Step 执行逻辑
4. **StepInit 服务**: 自动初始化和验证所有 Step

## 文件结构

```
src/modules/workflow-steps/
├── step-definition.interface.ts    # 核心接口和类型定义
├── step-registry.service.ts        # Step 注册表服务
├── step-executor.service.ts        # Step 执行引擎
├── step-init.service.ts            # 初始化服务
├── workflow-steps.module.ts        # NestJS 模块定义
├── index.ts                        # 导出文件
├── steps/                          # 具体步骤定义
│   ├── plan.step.ts               # PLAN 阶段
│   ├── outline.step.ts            # OUTLINE 阶段
│   ├── storyboard.step.ts         # STORYBOARD 阶段
│   ├── narration.step.ts          # NARRATION 阶段
│   ├── pages.step.ts              # PAGES 阶段
│   ├── tts.step.ts                # TTS 阶段
│   ├── render.step.ts             # RENDER 阶段
│   ├── merge.step.ts              # MERGE 阶段
│   └── done.step.ts               # DONE 阶段
└── __tests__/                      # 测试文件
    ├── step-registry.service.spec.ts
    ├── step-executor.service.spec.ts
    ├── step-definition.interface.spec.ts
    ├── plan.step.spec.ts
    ├── integration.spec.ts
    └── setup.ts
```

## 使用指南

### 1. 创建新的 Step 定义

```typescript
import { createStepDefinition } from '../step-definition.interface';
import { JobStage, ArtifactType } from '@prisma/client';
import { z } from 'zod';

export const customStep = createStepDefinition({
  stage: JobStage.CUSTOM_STAGE,  // 需要在 Prisma schema 中定义
  type: 'AI_GENERATION',        // 或 'PROCESSING'、'MERGE'
  name: 'Custom Step',
  description: '自定义步骤描述',
  
  // AI 配置（仅 AI_GENERATION 类型需要）
  aiConfig: {
    model: 'z-ai/glm-4.6',
    
    prompt: '处理 <input> 的提示词',
    schema: z.object({ result: z.string() }),
  },
  
  // 输入配置
  input: {
    sources: [JobStage.PLAN],    // 依赖的前置阶段
    schema: z.object({ input: z.any() }),
  },
  
  // 输出配置
  output: {
    type: ArtifactType.JSON,
    schema: z.object({ result: z.string() }),
  },
  
  // 执行配置
  execution: {
    requiresApproval: false,     // 是否需要用户审批
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 5000,
    },
    timeoutMs: 120000,
  },
  
  // 可选的自定义验证函数
  validate() {
    return {
      isValid: true,
      errors: [],
    };
  },
  
  // 可选的自定义执行逻辑（PROCESSING 和 MERGE 类型）
  async customExecute(input: any, context: ExecutionContext) {
    // 自定义处理逻辑
    return { result: 'processed' };
  },
});
```

### 2. 注册和使用 Step

```typescript
import { StepRegistryService, StepExecutorService } from './workflow-steps';

// 注册 Step
stepRegistry.register(customStep);

// 执行 Step
const result = await stepExecutor.execute(
  JobStage.CUSTOM_STAGE,
  'job-id',
  'input-data'
);

if (result.success) {
  console.log('Step 执行成功:', result.output);
} else {
  console.error('Step 执行失败:', result.error);
}
```

### 3. 在 Activities 中使用

```typescript
import { stepExecutorService } from '../temporal/activities/video-generation.activities';

export async function runCustomStage(input: VideoGenerationInput) {
  return await stepExecutorService.execute(JobStage.CUSTOM_STAGE, input.jobId, input.markdown);
}
```

## Step 类型说明

### AI_GENERATION 类型

- 使用 AI 模型生成内容
- 必须提供 `aiConfig` 配置
- 支持质量循环和自动修复
- 示例：PLAN、OUTLINE、STORYBOARD、NARRATION、PAGES

### PROCESSING 类型

- 执行自定义处理逻辑
- 必须实现 `customExecute` 函数
- 不需要 AI 配置
- 示例：TTS、RENDER

### MERGE 类型

- 合并多个输入源
- 可以使用默认合并逻辑或自定义逻辑
- 示例：MERGE、DONE

## 配置验证

### 依赖关系验证

系统会自动验证 Step 之间的依赖关系：

```typescript
const validation = stepRegistry.validateDependencies();
if (!validation.isValid) {
  console.error('依赖关系错误:', validation.errors);
}
```

### 配置完整性检查

```typescript
import { PromptopsService } from '../promptops/promptops.service';

const report = promptopsService.getStepConfigReport(JobStage.PLAN);
console.log('配置报告:', report);
```

## 错误处理

### 执行错误

```typescript
const result = await stepExecutor.execute(JobStage.PLAN, jobId, markdown);

if (!result.success) {
  // 错误信息包含在 result.error 中
  // 系统会自动更新任务状态为 FAILED
  console.error('执行失败:', result.error);
}
```

### 验证错误

```typescript
const step = stepRegistry.get(JobStage.PLAN);
if (!step) {
  throw new Error('Step 未注册');
}

const validation = validateStepDefinition(step);
if (!validation.isValid) {
  throw new Error(`Step 验证失败: ${validation.errors.join(', ')}`);
}
```

## 性能优化

### 缓存机制

- Step 定义在启动时注册，运行时无需重复验证
- Prompt 配置支持缓存，减少数据库查询
- 执行结果会检查现有 Artifact，避免重复生成

### 并发执行

```typescript
// 支持并发执行多个独立的 Step
const promises = [
  stepExecutor.execute(JobStage.STAGE_A, jobId, input),
  stepExecutor.execute(JobStage.STAGE_B, jobId, input),
];

const results = await Promise.all(promises);
```

## 测试

### 运行测试

```bash
# 运行所有测试
npm test -- src/modules/workflow-steps

# 运行特定测试
npm test -- src/modules/workflow-steps/__tests__/step-registry.service.spec.ts

# 生成覆盖率报告
npm test -- src/modules/workflow-steps --coverage
```

### 测试覆盖率

- 目标覆盖率：90% 以上
- 包含单元测试、集成测试和端到端测试
- 所有核心功能都有对应的测试用例

## 扩展指南

### 添加新的工作流阶段

1. 在 `prisma/schema.prisma` 中添加新的 `JobStage` 枚举值
2. 创建对应的 Step 定义文件
3. 在 `index.ts` 中导出新的 Step
4. 添加相应的测试用例
5. 更新工作流逻辑

### 修改现有 Step

1. 直接修改对应的 Step 定义文件
2. 更新相关的测试用例
3. 检查依赖关系是否仍然有效
4. 运行测试确保兼容性

### 自定义执行逻辑

```typescript
// 对于 PROCESSING 类型，实现 customExecute
async customExecute(input: any, context: ExecutionContext) {
  const { jobId, prisma, promptopsService } = context;
  
  // 自定义处理逻辑
  const result = await processInput(input);
  
  // 保存结果
  await prisma.artifact.create({
    data: {
      jobId,
      stage: this.stage,
      type: this.output.type,
      content: result,
    },
  });
  
  return result;
}
```

## 最佳实践

1. **保持 Step 独立**: 每个 Step 应该是独立的，不依赖其他 Step 的内部实现
2. **使用类型安全**: 充分利用 TypeScript 和 Zod 的类型检查
3. **错误处理**: 始终处理可能的错误情况
4. **测试覆盖**: 确保每个 Step 都有充分的测试
5. **文档更新**: 修改 Step 时及时更新相关文档
6. **性能考虑**: 避免在 Step 中执行耗时操作，考虑异步处理

## 故障排除

### 常见问题

1. **Step 未注册**: 检查 Step 是否在初始化时正确注册
2. **依赖关系错误**: 验证 Step 的输入依赖是否正确
3. **配置验证失败**: 检查 Step 配置是否符合 schema 要求
4. **执行超时**: 调整 `timeoutMs` 配置或优化执行逻辑

### 调试技巧

```typescript
// 启用详细日志
process.env.LOG_LEVEL = 'debug';

// 检查 Step 注册状态
console.log('已注册的 Step:', stepRegistry.getStages());

// 验证依赖关系
const depValidation = stepRegistry.validateDependencies();
console.log('依赖关系验证:', depValidation);

// 检查配置完整性
const configReport = promptopsService.validateAllStageConfigs();
console.log('配置报告:', configReport);
```

## 版本历史

- **v1.0.0**: 初始版本，实现基本的 Step 模块化架构
- **v1.1.0**: 添加自定义执行逻辑支持
- **v1.2.0**: 增强错误处理和验证机制
- **v1.3.0**: 添加性能优化和缓存机制

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 实现新功能或修复问题
4. 添加测试用例
5. 确保测试通过
6. 提交 Pull Request

## 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。
