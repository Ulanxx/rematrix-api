import { BadRequestException, Injectable } from '@nestjs/common';
import { JobStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type StageConfig = {
  id: string;
  stage: JobStage;
  model: string;
  temperature: number | null;
  prompt: string;
  tools: Record<string, unknown> | null;
  schema: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

type StageActive = {
  stage: JobStage;
  activeConfigId: string;
  updatedAt: Date;
  activeConfig?: StageConfig;
};

type PromptopsPrisma = {
  promptStageConfig: {
    findMany: (args: {
      where: { stage: JobStage };
      orderBy: { createdAt: 'desc' };
    }) => Promise<StageConfig[]>;
    create: (args: {
      data: {
        stage: JobStage;
        model: string;
        temperature?: number;
        prompt: string;
        tools?: unknown;
        schema?: unknown;
        meta?: unknown;
      };
    }) => Promise<StageConfig>;
    update: (args: {
      where: { id: string };
      data: {
        model?: string;
        temperature?: number;
        prompt?: string;
        tools?: unknown;
        schema?: unknown;
        meta?: unknown;
      };
    }) => Promise<StageConfig>;
    findUnique: (args: {
      where: { id: string };
    }) => Promise<StageConfig | null>;
    delete: (args: { where: { id: string } }) => Promise<StageConfig>;
  };
  promptStageActive: {
    upsert: (args: {
      where: { stage: JobStage };
      update: { activeConfigId: string };
      create: { stage: JobStage; activeConfigId: string };
      include: { activeConfig: true };
    }) => Promise<StageActive & { activeConfig: StageConfig }>;
    findUnique: (args: {
      where: { stage: JobStage };
      include: { activeConfig: true };
    }) => Promise<(StageActive & { activeConfig: StageConfig }) | null>;
  };
};

type CachedActiveConfig = {
  stage: JobStage;
  config: StageConfig;
  cachedAtMs: number;
};

@Injectable()
export class PromptopsService {
  private activeCache = new Map<JobStage, CachedActiveConfig>();
  private readonly cacheTtlMs = 3_000;

  constructor(private readonly prisma: PrismaService) {}

  private get promptopsPrisma(): PromptopsPrisma {
    return this.prisma as unknown as PromptopsPrisma;
  }

  private parseStage(stage: string): JobStage {
    const allowed = Object.values(JobStage) as string[];
    if (!allowed.includes(stage)) {
      throw new BadRequestException('invalid stage');
    }
    return stage as JobStage;
  }

  listStages() {
    return Object.values(JobStage);
  }

  async listConfigs(stageRaw: string) {
    const stage = this.parseStage(stageRaw);
    return await this.promptopsPrisma.promptStageConfig.findMany({
      where: { stage },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createConfig(input: {
    stage: string;
    model: string;
    temperature?: number;
    prompt: string;
    tools?: unknown;
    schema?: unknown;
    meta?: unknown;
  }) {
    const stage = this.parseStage(input.stage);
    return await this.promptopsPrisma.promptStageConfig.create({
      data: {
        stage,
        model: input.model,
        temperature: input.temperature,
        prompt: input.prompt,
        tools: input.tools,
        schema: input.schema,
        meta: input.meta,
      },
    });
  }

  async updateConfig(
    id: string,
    patch: {
      model?: string;
      temperature?: number;
      prompt?: string;
      tools?: unknown;
      schema?: unknown;
      meta?: unknown;
    },
  ) {
    return await this.promptopsPrisma.promptStageConfig.update({
      where: { id },
      data: {
        model: patch.model,
        temperature: patch.temperature,
        prompt: patch.prompt,
        tools: patch.tools,
        schema: patch.schema,
        meta: patch.meta,
      },
    });
  }

  async deleteConfig(id: string) {
    const config = await this.promptopsPrisma.promptStageConfig.findUnique({
      where: { id },
    });
    if (!config) {
      throw new BadRequestException('config not found');
    }

    const active = await this.promptopsPrisma.promptStageActive.findUnique({
      where: { stage: config.stage },
      include: { activeConfig: true },
    });

    if (active?.activeConfigId === id) {
      throw new BadRequestException('cannot delete active config');
    }

    this.activeCache.delete(config.stage);
    return await this.promptopsPrisma.promptStageConfig.delete({
      where: { id },
    });
  }

  async publish(stageRaw: string, configId: string) {
    const stage = this.parseStage(stageRaw);

    const config = await this.promptopsPrisma.promptStageConfig.findUnique({
      where: { id: configId },
    });
    if (!config || config.stage !== stage) {
      throw new BadRequestException('config not found for stage');
    }

    const active = await this.promptopsPrisma.promptStageActive.upsert({
      where: { stage },
      update: { activeConfigId: configId },
      create: { stage, activeConfigId: configId },
      include: { activeConfig: true },
    });

    this.activeCache.delete(stage);

    return active;
  }

  async bootstrap(stageRaw: string) {
    const stage = this.parseStage(stageRaw);

    const existing = await this.promptopsPrisma.promptStageConfig.findMany({
      where: { stage },
      orderBy: { createdAt: 'desc' },
    });

    const config =
      existing[0] ??
      (await this.promptopsPrisma.promptStageConfig.create({
        data: {
          stage,
          model: this.defaultModel(stage),
          prompt: this.defaultPrompt(stage),
        },
      }));

    const active = await this.promptopsPrisma.promptStageActive.upsert({
      where: { stage },
      update: { activeConfigId: config.id },
      create: { stage, activeConfigId: config.id },
      include: { activeConfig: true },
    });

    this.activeCache.delete(stage);
    return active;
  }

  private defaultModel(stage: JobStage) {
    const defaults: Partial<Record<JobStage, string>> = {
      PLAN: 'z-ai/glm-4.6v',
      OUTLINE: 'z-ai/glm-4.6v',
      STORYBOARD: 'z-ai/glm-4.6v',
      NARRATION: 'z-ai/glm-4.6v',
      PAGES: 'z-ai/glm-4.6v',
      TTS: 'z-ai/glm-4.6v',
      RENDER: 'z-ai/glm-4.6v',
      MERGE: 'z-ai/glm-4.6v',
      DONE: 'z-ai/glm-4.6v',
    };
    return defaults[stage] ?? 'z-ai/glm-4.6v';
  }

  private defaultPrompt(stage: JobStage) {
    const base = (params: {
      stage: JobStage;
      role: string;
      goal: string;
      inputs: string[];
      output: string;
    }) => {
      return `# role\n${params.role}\n\n---\n\n# context\n你正在执行视频生成流水线的 ${params.stage} 阶段。\n\n---\n\n# instructions\n${params.goal}\n\n---\n\n# variables\n${params.inputs.map((i) => `- ${i}`).join('\n')}\n\n---\n\n# output_schema\n${params.output}\n\n---\n\n# constraints\n- 禁止使用 \`{{...}}\` 形式的变量占位符；所有变量必须使用尖括号（例如 \`<markdown>\`）。\n- 只输出最终产物，禁止输出解释性文字。\n- 严格遵守输出 schema；字段缺失时优先给出空数组/空字符串等安全默认值（除非 schema 禁止）。\n\n---\n\n# self_checklist\n- 输出是否为合法 JSON？\n- 是否包含 schema 规定的所有必需字段？\n- 是否没有出现 \`{{...}}\`？\n`;
    };

    const defaults: Partial<Record<JobStage, string>> = {
      PLAN: base({
        stage: JobStage.PLAN,
        role: '你是一名资深视频策划与教学设计专家。',
        goal: '根据 <markdown> 生成一份可执行的 PLAN（计划），用于指导后续 OUTLINE/STORYBOARD/NARRATION/PAGES 的生成。',
        inputs: ['<markdown> 用户输入的 Markdown 原文'],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入，不要自行扩展字段）。',
      }),
      OUTLINE: base({
        stage: JobStage.OUTLINE,
        role: '你是一名资深课程结构化专家，擅长把内容拆成清晰的大纲。',
        goal: '根据 <markdown> 与 <plan_json> 生成 OUTLINE，用于指导 STORYBOARD。',
        inputs: [
          '<markdown> 用户输入的 Markdown 原文',
          '<plan_json> 上游 PLAN 阶段 JSON',
        ],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
      STORYBOARD: base({
        stage: JobStage.STORYBOARD,
        role: '你是一名分镜设计师，擅长将大纲转成逐页分镜。',
        goal: '根据 <outline_json> 生成 STORYBOARD，按页产出画面要点与旁白提示。',
        inputs: ['<outline_json> 上游 OUTLINE 阶段 JSON'],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
      NARRATION: base({
        stage: JobStage.NARRATION,
        role: '你是一名旁白撰稿与配音导演，擅长写口播稿。',
        goal: '根据 <storyboard_json> 与 <markdown> 生成逐页 NARRATION 文本。',
        inputs: [
          '<storyboard_json> 上游 STORYBOARD 阶段 JSON',
          '<markdown> 用户输入的 Markdown 原文',
        ],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
      PAGES: base({
        stage: JobStage.PAGES,
        role: '你是一名课件脚本工程师，擅长把分镜与旁白转为可渲染页面数据。',
        goal: '根据 <storyboard_json> 与 <narration_json> 生成 PAGES 页面结构数据。',
        inputs: [
          '<storyboard_json> 上游 STORYBOARD 阶段 JSON',
          '<narration_json> 上游 NARRATION 阶段 JSON',
        ],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
      TTS: base({
        stage: JobStage.TTS,
        role: '你是一名 TTS 文本标准化助手。',
        goal: '根据 <narration_json> 生成 TTS 输入（若系统实际不调用 LLM，则该 prompt 仅用于占位/后续扩展）。',
        inputs: ['<narration_json> 上游 NARRATION 阶段 JSON'],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
      RENDER: base({
        stage: JobStage.RENDER,
        role: '你是一名渲染参数助手。',
        goal: '根据 <pages_json> 生成渲染阶段需要的参数（若系统不调用 LLM，则该 prompt 仅用于占位/后续扩展）。',
        inputs: ['<pages_json> 上游 PAGES 阶段 JSON'],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
      MERGE: base({
        stage: JobStage.MERGE,
        role: '你是一名视频合成参数助手。',
        goal: '根据 <render_outputs> 生成合并阶段需要的参数（若系统不调用 LLM，则该 prompt 仅用于占位/后续扩展）。',
        inputs: ['<render_outputs> 上游 RENDER 产物/信息'],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
      DONE: base({
        stage: JobStage.DONE,
        role: '你是一名执行总结助手。',
        goal: '输出一个简短的 DONE 标记对象。',
        inputs: ['<job_id> 当前任务 ID'],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
    };
    return defaults[stage] ?? 'You are a helpful assistant.';
  }

  async getActiveConfig(stageRaw: string) {
    const stage = this.parseStage(stageRaw);
    const cached = this.activeCache.get(stage);
    const now = Date.now();
    if (cached && now - cached.cachedAtMs < this.cacheTtlMs) {
      return cached.config;
    }

    const active = await this.promptopsPrisma.promptStageActive.findUnique({
      where: { stage },
      include: { activeConfig: true },
    });

    if (!active?.activeConfig) {
      return null;
    }

    this.activeCache.set(stage, {
      stage,
      config: active.activeConfig,
      cachedAtMs: now,
    });

    return active.activeConfig;
  }
}
