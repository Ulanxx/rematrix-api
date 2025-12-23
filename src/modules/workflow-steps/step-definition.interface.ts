import { JobStage, ArtifactType } from '@prisma/client';
import { z } from 'zod';

/**
 * Step 类型定义
 */
export type StepType = 'AI_GENERATION' | 'PROCESSING';

/**
 * 重试策略配置
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
}

/**
 * Step 执行配置
 */
export interface StepExecutionConfig {
  requiresApproval: boolean;
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;
}

/**
 * Step 输入配置
 */
export interface StepInputConfig {
  sources: JobStage[];
  schema: z.ZodType<any>;
  description?: string;
}

/**
 * Step 输出配置
 */
export interface StepOutputConfig {
  type: ArtifactType;
  schema: z.ZodType<any>;
  description?: string;
}

/**
 * Step AI 配置
 */
export interface StepAIConfig {
  model: string;
  temperature?: number;
  prompt: string;
  tools?: Record<string, unknown>;
  schema?: z.ZodType<any>;
  meta?: Record<string, unknown>;
}

/**
 * 完整的 Step 定义接口
 */
export interface StepDefinition {
  stage: JobStage;
  type: StepType;
  name: string;
  description: string;

  // AI 配置（仅 AI_GENERATION 类型需要）
  aiConfig?: StepAIConfig;

  // 输入输出配置
  input: StepInputConfig;
  output: StepOutputConfig;

  // 执行配置
  execution: StepExecutionConfig;

  // 验证函数
  validate?(): ValidationResult;

  // 自定义执行逻辑（可选，用于非 AI 生成的步骤）
  customExecute?(input: any, context: ExecutionContext): Promise<any>;

  // 自定义输入准备逻辑（可选，用于自定义输入数据处理）
  customPrepareInput?(
    jobId: string,
    context: ExecutionContext,
    markdown?: string,
  ): Promise<any>;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  jobId: string;
  apiKey: string;
  prisma: {
    artifact: {
      findFirst: (args: any) => Promise<{ content: unknown } | null>;
      findMany: (args: any) => Promise<any[]>;
    };
  };
  promptopsService: any;
  // 前面步骤的 AI response 内容
  previousStepsContext?: Record<string, unknown>;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Step 执行结果
 */
export interface StepExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 注册的 Step 信息
 */
export interface RegisteredStep {
  definition: StepDefinition;
  registeredAt: Date;
}

/**
 * Step 定义验证 Schema
 */
export const stepDefinitionSchema = z.object({
  stage: z.enum(['PLAN', 'OUTLINE', 'STORYBOARD', 'PAGES', 'DONE']),
  type: z.enum(['AI_GENERATION', 'PROCESSING']),
  name: z.string().min(1),
  description: z.string().min(1),
  aiConfig: z
    .object({
      model: z.string().min(1),
      temperature: z.number().min(0).max(2).optional(),
      prompt: z.string().min(1),
      tools: z.record(z.string(), z.unknown()).optional(),
      schema: z.any().optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  input: z.object({
    sources: z.array(
      z.enum(['PLAN', 'OUTLINE', 'STORYBOARD', 'PAGES', 'DONE']),
    ),
    schema: z.any(),
    description: z.string().optional(),
  }),
  output: z.object({
    type: z.enum([
      'JSON',
      'MARKDOWN',
      'TEXT',
      'AUDIO',
      'IMAGE',
      'VIDEO',
      'SUBTITLES',
    ]),
    schema: z.any(),
    description: z.string().optional(),
  }),
  execution: z.object({
    requiresApproval: z.boolean(),
    retryPolicy: z
      .object({
        maxAttempts: z.number().min(1),
        backoffMs: z.number().min(0),
        maxBackoffMs: z.number().min(0),
      })
      .optional(),
    timeoutMs: z.number().min(1000).optional(),
  }),
});

/**
 * 创建 Step 定义的辅助函数
 */
export function createStepDefinition(config: StepDefinition): StepDefinition {
  // 验证配置
  const validation = stepDefinitionSchema.safeParse(config);
  if (!validation.success) {
    throw new Error(`Invalid step definition: ${validation.error.message}`);
  }

  return config;
}

/**
 * 验证 Step 定义的辅助函数
 */
export function validateStepDefinition(
  definition: StepDefinition,
): ValidationResult {
  const validation = stepDefinitionSchema.safeParse(definition);

  if (!validation.success) {
    return {
      isValid: false,
      errors: validation.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      ),
    };
  }

  // 自定义验证逻辑
  const errors: string[] = [];

  // AI_GENERATION 类型必须有 aiConfig
  if (definition.type === 'AI_GENERATION' && !definition.aiConfig) {
    errors.push('AI_GENERATION steps must have aiConfig');
  }

  // 验证输入依赖的顺序
  const stageOrder = ['PLAN', 'OUTLINE', 'STORYBOARD', 'PAGES', 'DONE'];
  const currentStageIndex = stageOrder.indexOf(definition.stage);

  for (const sourceStage of definition.input.sources) {
    const sourceStageIndex = stageOrder.indexOf(sourceStage);
    if (sourceStageIndex >= currentStageIndex) {
      errors.push(
        `Input source ${sourceStage} must come before ${definition.stage}`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
