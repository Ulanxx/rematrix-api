import { JobStage, ArtifactType } from '@prisma/client';
import { z } from 'zod';
import {
  StepDefinition,
  createStepDefinition,
} from '../step-definition.interface';

/**
 * PLAN 阶段的输出 Schema
 */
export const planOutputSchema = z.object({
  estimatedPages: z.number().int().min(1).max(40),
  estimatedDurationSec: z.number().int().min(10).max(600),
  style: z.string().min(1),
  questions: z.array(z.string()).default([]),
});

/**
 * PLAN 阶段的输入 Schema
 */
export const planInputSchema = z.object({
  originContent: z.string().min(1),
  style: z.string().default(''),
});

/**
 * PLAN 阶段定义
 * 根据用户输入的 Markdown 文档生成视频制作计划
 */
export const planStep: StepDefinition = createStepDefinition({
  stage: JobStage.PLAN,
  type: 'AI_GENERATION',
  name: 'Plan Generation',
  description:
    '根据 Markdown 文档生成可执行的视频制作计划，用于指导后续各个阶段的生成',

  // AI 配置
  aiConfig: {
    model: 'z-ai/glm-4.6',

    prompt: `# role
你是一名资深视频策划与教学设计专家。

---

# context
你正在执行视频生成流水线的 PLAN 阶段。

---

# instructions
根据 <markdown> 生成一份可执行的 PLAN（计划），用于指导后续 OUTLINE/STORYBOARD/NARRATION/PAGES 的生成。

---

# variables
- <markdown> 用户输入的 Markdown 原文

---

# output_schema
请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入，不要自行扩展字段）。

---

# constraints
- 禁止使用 \`{{...}}\` 形式的变量占位符；所有变量必须使用尖括号（例如 \`<markdown>\`）。
- 只输出最终产物，禁止输出解释性文字。
- 严格遵守输出 schema；字段缺失时优先给出空数组/空字符串等安全默认值（除非 schema 禁止）。

---

# self_checklist
- 输出是否为合法 JSON？
- 是否包含 schema 规定的所有必需字段？
- 是否没有出现 \`{{...}}\`？`,
    tools: undefined,
    schema: planOutputSchema,
    meta: {
      category: 'planning',
      complexity: 'medium',
      estimatedTokens: 500,
    },
  },

  // 输入配置
  input: {
    sources: [], // PLAN 是起始阶段，无依赖
    schema: planInputSchema,
    description: '用户输入的 Markdown 文档内容',
  },

  // 输出配置
  output: {
    type: ArtifactType.JSON,
    schema: planOutputSchema,
    description: '视频制作计划，包含预估页数、时长、风格和问题',
  },

  // 执行配置
  execution: {
    requiresApproval: true, // PLAN 需要用户审批
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 5000,
    },
    timeoutMs: 120000, // 2 分钟超时
  },

  // 验证函数
  validate() {
    const errors: string[] = [];

    // 验证输出页数的合理性
    const testOutput = {
      estimatedPages: 25,
      estimatedDurationSec: 300,
      style: 'professional',
      questions: ['测试问题'],
    };

    const validation = planOutputSchema.safeParse(testOutput);
    if (!validation.success) {
      errors.push(
        `Output schema validation failed: ${validation.error.message}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
});

export default planStep;
