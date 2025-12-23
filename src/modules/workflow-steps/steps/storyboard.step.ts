import { JobStage, ArtifactType } from '@prisma/client';
import { z } from 'zod';
import {
  StepDefinition,
  createStepDefinition,
  ExecutionContext,
} from '../step-definition.interface';

/**
 * STORYBOARD 阶段的输出 Schema
 */
export const storyboardOutputSchema = z.object({
  pages: z.array(
    z.object({
      page: z.number().int().min(1),
      visual: z.array(z.string().min(1)).min(1),
      narrationHints: z.array(z.string().min(1)).min(1),
    }),
  ),
});

/**
 * STORYBOARD 阶段的输入 Schema
 */
export const storyboardInputSchema = z.object({
  outline: z.object({
    title: z.string(),
    sections: z.array(
      z.object({
        title: z.string(),
        bullets: z.array(z.string()),
      }),
    ),
  }),
});

/**
 * STORYBOARD 阶段的自定义输入准备函数
 */
async function prepareStoryboardInput(
  jobId: string,
  context: ExecutionContext,
): Promise<Record<string, unknown>> {
  if (!context) {
    throw new Error('Context is required for storyboard input preparation');
  }

  const inputData: Record<string, unknown> = {};

  // 获取 OUTLINE 阶段的输出（STORYBOARD 不需要原始 markdown）
  const outlineArtifact = await context.prisma.artifact.findFirst({
    where: {
      jobId,
      stage: JobStage.OUTLINE,
      type: ArtifactType.JSON,
    },
    orderBy: { version: 'desc' },
    select: { content: true },
  });

  if (outlineArtifact?.content) {
    inputData.outline = outlineArtifact.content;
  }

  return inputData;
}

/**
 * STORYBOARD 阶段定义
 * 根据 OUTLINE 生成逐页分镜脚本
 */
export const storyboardStep: StepDefinition = createStepDefinition({
  stage: JobStage.STORYBOARD,
  type: 'AI_GENERATION',
  name: 'Storyboard Generation',
  description: '根据大纲转成逐页分镜，为每页设计画面要点和旁白提示',

  // AI 配置
  aiConfig: {
    model: 'z-ai/glm-4.6',

    prompt: `# role
你是一名分镜设计师，擅长将大纲转成逐页分镜。

---

# context
你正在执行视频生成流水线的 STORYBOARD 阶段。

---

# instructions
根据 <outline_json> 生成 STORYBOARD，按页产出画面要点与旁白提示。

---

# variables
- <outline_json> 上游 OUTLINE 阶段 JSON

---

# output_schema
请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。

---

# constraints
- 禁止使用 \`{{...}}\` 形式的变量占位符；所有变量必须使用尖括号（例如 \`<outline>\`）。
- 只输出最终产物，禁止输出解释性文字。
- 严格遵守输出 schema；字段缺失时优先给出空数组/空字符串等安全默认值（除非 schema 禁止）。
- 页面编号必须从 1 开始连续编号。
- 每页至少包含一个视觉要点和一个旁白提示。
- 视觉要点要具体描述画面内容，旁白提示要简洁明了。

---

# self_checklist
- 输出是否为合法 JSON？
- 是否包含 schema 规定的所有必需字段？
- 是否没有出现 \`{{...}}\`？
- 页面编号是否连续？
- 每页是否有足够的视觉和旁白信息？`,
    tools: undefined,
    schema: storyboardOutputSchema,
    meta: {
      category: 'visual_design',
      complexity: 'medium',
      estimatedTokens: 1200,
    },
  },

  // 输入配置
  input: {
    sources: [JobStage.OUTLINE], // 依赖 OUTLINE 阶段
    schema: storyboardInputSchema,
    description: 'OUTLINE 阶段的结构化大纲',
  },

  // 输出配置
  output: {
    type: ArtifactType.JSON,
    schema: storyboardOutputSchema,
    description: '逐页分镜脚本，包含每页的画面要点和旁白提示',
  },

  // 执行配置
  execution: {
    requiresApproval: false, // STORYBOARD 不需要用户审批
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 5000,
    },
    timeoutMs: 150000, // 2.5 分钟超时
  },

  // 自定义输入准备函数
  customPrepareInput: prepareStoryboardInput,

  // 验证函数
  validate() {
    const errors: string[] = [];

    // 验证输出结构的合理性
    const testOutput = {
      pages: [
        {
          page: 1,
          visual: ['画面描述1', '画面描述2'],
          narrationHints: ['旁白提示1', '旁白提示2'],
        },
        {
          page: 2,
          visual: ['画面描述3'],
          narrationHints: ['旁白提示3'],
        },
      ],
    };

    const validation = storyboardOutputSchema.safeParse(testOutput);
    if (!validation.success) {
      errors.push(
        `Output schema validation failed: ${validation.error.message}`,
      );
    }

    // 验证页面编号连续性
    const pages = testOutput.pages;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].page !== i + 1) {
        errors.push(`Page numbers must be consecutive starting from 1`);
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
});

export default storyboardStep;
