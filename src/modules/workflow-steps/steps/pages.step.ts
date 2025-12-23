import { JobStage, ArtifactType } from '@prisma/client';
import { z } from 'zod';
import {
  StepDefinition,
  createStepDefinition,
  ExecutionContext,
} from '../step-definition.interface';

/**
 * PAGES 阶段的输出 Schema
 */
export const pagesOutputSchema = z.object({
  theme: z.object({
    primary: z.string().min(1),
    background: z.string().min(1),
    text: z.string().min(1),
  }),
  slides: z.array(
    z.object({
      title: z.string().min(1),
      bullets: z.array(z.string().min(1)).min(1),
      design: z.string(),
    }),
  ),
  pdfUrl: z.string().optional(), // PDF下载链接
  pdfGenerated: z.boolean().default(false), // PDF生成状态
});

/**
 * PAGES 阶段的输入 Schema
 */
export const pagesInputSchema = z.object({
  storyboard: z.object({
    pages: z.array(
      z.object({
        page: z.number(),
        visual: z.array(z.string()),
        narrationHints: z.array(z.string()),
      }),
    ),
  }),
});

/**
 * PAGES 阶段的自定义输入准备函数
 */
async function preparePagesInput(
  jobId: string,
  context: ExecutionContext,
): Promise<Record<string, unknown>> {
  if (!context) {
    throw new Error('Context is required for pages input preparation');
  }

  const inputData: Record<string, unknown> = {};

  // 获取 STORYBOARD 阶段的输出
  const storyboardArtifact = await context.prisma.artifact.findFirst({
    where: {
      jobId,
      stage: JobStage.STORYBOARD,
      type: ArtifactType.JSON,
    },
    orderBy: { version: 'desc' },
    select: { content: true },
  });

  if (storyboardArtifact?.content) {
    inputData.storyboard = storyboardArtifact.content;
  }

  return inputData;
}

/**
 * PAGES 阶段定义
 * 根据 STORYBOARD 生成可渲染的页面结构数据
 */
export const pagesStep: StepDefinition = createStepDefinition({
  stage: JobStage.PAGES,
  type: 'AI_GENERATION',
  name: 'Pages Generation',
  description: '根据分镜脚本转为可渲染页面数据，用于PDF生成',

  // AI 配置
  aiConfig: {
    model: 'z-ai/glm-4.6',
    temperature: 0.5,
    prompt: `# role
你是一名课件脚本工程师，擅长把分镜脚本转为可渲染页面数据并生成PDF文档。

---

# context
你正在执行视频生成流水线的 PAGES 阶段，这是最后的内容生成阶段。

---

# instructions
根据 <storyboard_json> 生成 PAGES 页面结构数据，并标记PDF生成状态。

---

# variables
- <storyboard_json> 上游 STORYBOARD 阶段 JSON

---

# output_schema
请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。

---

# constraints
- 禁止使用 \`{{...}}\` 形式的变量占位符；所有变量必须使用尖括号（例如 \`<storyboard>\`）。
- 只输出最终产物，禁止输出解释性文字。
- 严格遵守输出 schema；字段缺失时优先给出空数组/空字符串等安全默认值（除非 schema 禁止）。
- 主题色彩要协调，符合内容风格。
- 每页幻灯片要有清晰的标题和要点。
- 要点数量要适中，一般 3-6 个为宜。
- 页面数量要与分镜保持一致。
- 设置 pdfGenerated 为 true 表示PDF已准备生成。
- pdfUrl 字段暂时留空或设置占位符URL。

---

# self_checklist
- 输出是否为合法 JSON？
- 是否包含 schema 规定的所有必需字段？
- 是否没有出现 \`{{...}}\`？
- 主题色彩是否合理？
- 每页是否有标题和要点？
- 页面数量是否匹配输入？
- pdfGenerated 是否设置为 true？`,
    tools: undefined,
    schema: pagesOutputSchema,
    meta: {
      category: 'slide_design',
      complexity: 'medium',
      estimatedTokens: 1500,
    },
  },

  // 输入配置
  input: {
    sources: [JobStage.STORYBOARD], // 仅依赖 STORYBOARD 阶段
    schema: pagesInputSchema,
    description: 'STORYBOARD 阶段的分镜脚本',
  },

  // 输出配置
  output: {
    type: ArtifactType.JSON,
    schema: pagesOutputSchema,
    description: '可渲染的页面结构数据，包含主题和幻灯片内容，用于PDF生成',
  },

  // 执行配置
  execution: {
    requiresApproval: true, // PAGES 需要用户审批
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 5000,
    },
    timeoutMs: 180000, // 3 分钟超时
  },

  // 自定义输入准备函数
  customPrepareInput: preparePagesInput,

  // 验证函数
  validate() {
    const errors: string[] = [];

    // 验证输出结构的合理性
    const testOutput = {
      theme: {
        primary: '#4285F4',
        background: '#F8F9FA',
        text: '#202124',
      },
      slides: [
        {
          title: '第一页标题',
          bullets: ['要点1', '要点2', '要点3'],
        },
        {
          title: '第二页标题',
          bullets: ['要点1', '要点2'],
        },
      ],
    };

    const validation = pagesOutputSchema.safeParse(testOutput);
    if (!validation.success) {
      errors.push(
        `Output schema validation failed: ${validation.error.message}`,
      );
    }

    // 验证主题色彩格式
    const theme = testOutput.theme;
    const colorRegex = /^#[0-9A-F]{6}$/i;
    if (!colorRegex.test(theme.primary)) {
      errors.push('Primary color must be a valid hex color');
    }
    if (!colorRegex.test(theme.background)) {
      errors.push('Background color must be a valid hex color');
    }
    if (!colorRegex.test(theme.text)) {
      errors.push('Text color must be a valid hex color');
    }

    // 验证幻灯片内容
    for (const slide of testOutput.slides) {
      if (slide.bullets.length < 1) {
        errors.push(`Each slide must have at least one bullet point`);
      }
      if (slide.bullets.length > 8) {
        errors.push(`Each slide should have at most 8 bullet points`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
});

export default pagesStep;
