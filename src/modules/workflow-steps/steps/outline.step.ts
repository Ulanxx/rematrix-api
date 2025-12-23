import { JobStage, ArtifactType } from '@prisma/client';
import { z } from 'zod';
import {
  StepDefinition,
  createStepDefinition,
  ExecutionContext,
} from '../step-definition.interface';

/**
 * OUTLINE 阶段的输出 Schema
 */
export const outlineOutputSchema = z.object({
  title: z.string().min(1),
  sections: z.array(
    z.object({
      title: z.string().min(1),
      bullets: z.array(z.string().min(1)).min(1),
    }),
  ),
});

/**
 * OUTLINE 阶段的输入 Schema
 */
export const outlineInputSchema = z.object({
  originContent: z.string().min(1),
  plan: z.object({
    estimatedPages: z.number(),
    estimatedDurationSec: z.number(),
    style: z.string(),
    questions: z.array(z.string()),
  }),
});

/**
 * OUTLINE 阶段的自定义输入准备函数
 */
async function prepareOutlineInput(
  jobId: string,
  context: ExecutionContext,
  originContent?: string,
): Promise<Record<string, unknown>> {
  if (!context) {
    throw new Error('Context is required for outline input preparation');
  }

  const inputData: Record<string, unknown> = {};

  // 添加 originContent（如果提供）
  if (originContent) {
    inputData.originContent = originContent;
  }

  // 获取 PLAN 阶段的输出
  const planArtifact = await context.prisma.artifact.findFirst({
    where: {
      jobId,
      stage: JobStage.PLAN,
      type: ArtifactType.JSON,
    },
    orderBy: { version: 'desc' },
    select: { content: true },
  });

  if (planArtifact?.content) {
    inputData.plan = planArtifact.content;
  }

  return inputData;
}

/**
 * OUTLINE 阶段定义
 * 根据 Markdown 文档和 PLAN 生成结构化大纲
 */
export const outlineStep: StepDefinition = createStepDefinition({
  stage: JobStage.OUTLINE,
  type: 'AI_GENERATION',
  name: 'Outline Generation',
  description:
    '根据 Markdown 文档与 PLAN 生成结构化大纲，用于指导 STORYBOARD 阶段',

  // AI 配置
  aiConfig: {
    model: 'z-ai/glm-4.6',

    prompt: `# role
你是一名资深课程结构化专家，擅长把内容拆成清晰的大纲。

---

# context
你正在执行视频生成流水线的 OUTLINE 阶段。

---

# instructions
根据 <markdown> 与 <plan_json> 生成 OUTLINE，用于指导 STORYBOARD。

---

# variables
- <markdown> 用户输入的 Markdown 原文
- <plan_json> 上游 PLAN 阶段 JSON

---

# output_schema
请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。

---

# constraints
- 禁止使用 \`{{...}}\` 形式的变量占位符；所有变量必须使用尖括号（例如 \`<markdown>\`）。
- 只输出最终产物，禁止输出解释性文字。
- 严格遵守输出 schema；字段缺失时优先给出空数组/空字符串等安全默认值（除非 schema 禁止）。
- 大纲结构要清晰，每个部分至少包含一个要点。
- 标题要简洁有力，要点要具体明确。

---

# self_checklist
- 输出是否为合法 JSON？
- 是否包含 schema 规定的所有必需字段？
- 是否没有出现 \`{{...}}\`？
- 大纲结构是否合理？
- 每个部分是否都有足够的要点？`,
    tools: undefined,
    schema: outlineOutputSchema,
    meta: {
      category: 'structuring',
      complexity: 'medium',
      estimatedTokens: 800,
    },
  },

  // 输入配置
  input: {
    sources: [JobStage.PLAN], // 依赖 PLAN 阶段
    schema: outlineInputSchema,
    description: 'Markdown 文档和 PLAN 阶段的输出',
  },

  // 输出配置
  output: {
    type: ArtifactType.JSON,
    schema: outlineOutputSchema,
    description: '结构化大纲，包含标题和各个章节的要点',
  },

  // 执行配置
  execution: {
    requiresApproval: false, // OUTLINE 不需要用户审批
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 5000,
    },
    timeoutMs: 120000, // 2 分钟超时
  },

  // 自定义输入准备函数
  customPrepareInput: prepareOutlineInput,

  // 验证函数
  validate() {
    const errors: string[] = [];

    // 验证输出结构的合理性
    const testOutput = {
      title: '测试标题',
      sections: [
        {
          title: '第一部分',
          bullets: ['要点1', '要点2', '要点3'],
        },
        {
          title: '第二部分',
          bullets: ['要点1', '要点2'],
        },
      ],
    };

    const validation = outlineOutputSchema.safeParse(testOutput);
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

export default outlineStep;
