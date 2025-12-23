import { BadRequestException, Injectable } from '@nestjs/common';
import { JobStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  StepDefinition,
  validateStepDefinition,
} from '../workflow-steps/step-definition.interface';

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
    const defaults: Record<JobStage, string> = {
      PLAN: 'z-ai/glm-4.6',
      OUTLINE: 'z-ai/glm-4.6',
      STORYBOARD: 'z-ai/glm-4.6',
      PAGES: 'z-ai/glm-4.6',
      DONE: 'z-ai/glm-4.6',
    };
    return defaults[stage] ?? 'z-ai/glm-4.6';
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
      PAGES: base({
        stage: JobStage.PAGES,
        role: '你是一名课件脚本工程师，擅长把分镜转为可渲染页面数据。',
        goal: '根据 <storyboard_json> 生成 PAGES 页面结构数据。',
        inputs: ['<storyboard_json> 上游 STORYBOARD 阶段 JSON'],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
      DONE: base({
        stage: JobStage.DONE,
        role: '你是一名工作流完成助手。',
        goal: '根据 <job_id> 完成工作流。',
        inputs: ['<job_id> 工作流ID'],
        output:
          '请严格输出 JSON，结构必须符合本 stage 的 schema（由系统注入）。',
      }),
    };
    return defaults[stage] ?? '你是一名助手。';
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

  /**
   * 验证 Step 配置的完整性
   * 支持新的 Step 模块化架构
   */
  validateStepConfig(
    stage: JobStage,
    config: any,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 基础字段验证
    if (!config.model || typeof config.model !== 'string') {
      errors.push('Model is required and must be a string');
    }

    if (
      config.temperature !== null &&
      (typeof config.temperature !== 'number' ||
        config.temperature < 0 ||
        config.temperature > 2)
    ) {
      errors.push('Temperature must be a number between 0 and 2, or null');
    }

    if (!config.prompt || typeof config.prompt !== 'string') {
      errors.push('Prompt is required and must be a string');
    }

    // 验证 prompt 中包含正确的变量占位符
    const requiredVariables = this.getRequiredVariablesForStage(stage);
    const missingVariables = requiredVariables.filter(
      (variable) => !config.prompt.includes(variable),
    );
    if (missingVariables.length > 0) {
      errors.push(
        `Prompt must include required variables: ${missingVariables.join(', ')}`,
      );
    }

    // 检查是否使用了已弃用的 {{}} 格式
    if (config.prompt.includes('{{') || config.prompt.includes('}}')) {
      errors.push('Prompt must use <> format for variables, not {{}} format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取指定阶段所需的变量列表
   */
  private getRequiredVariablesForStage(stage: JobStage): string[] {
    const variableMap: Record<JobStage, string[]> = {
      [JobStage.PLAN]: ['<markdown>'],
      [JobStage.OUTLINE]: ['<markdown>', '<plan_json>'],
      [JobStage.STORYBOARD]: ['<outline_json>'],
      [JobStage.PAGES]: ['<storyboard_json>'],
      [JobStage.DONE]: ['<job_id>'],
    };

    return variableMap[stage] || [];
  }

  /**
   * 验证 Step 定义与配置的兼容性
   */
  validateStepCompatibility(
    stepDefinition: StepDefinition,
    config: any,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证 Step 定义本身
    const stepValidation = validateStepDefinition(stepDefinition);
    if (!stepValidation.isValid) {
      errors.push(...stepValidation.errors);
    }

    // 验证配置与 Step 定义的兼容性
    if (stepDefinition.type === 'AI_GENERATION') {
      if (!config.model) {
        errors.push('AI_GENERATION steps require a model configuration');
      }

      if (!config.prompt) {
        errors.push('AI_GENERATION steps require a prompt configuration');
      }

      // 检查模型是否在支持列表中
      const supportedModels = [
        'z-ai/glm-4.6',
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
      ];

      if (config.model && !supportedModels.includes(config.model as string)) {
        errors.push(
          `Model ${config.model} is not in the supported list: ${supportedModels.join(', ')}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取 Step 配置的完整性报告
   */
  async getStepConfigReport(stage: JobStage): Promise<{
    stage: JobStage;
    hasActiveConfig: boolean;
    configValid: boolean;
    errors: string[];
    recommendations: string[];
  }> {
    const errors: string[] = [];
    const recommendations: string[] = [];

    // 检查是否有活跃配置
    const activeConfig = await this.getActiveConfig(stage);
    const hasActiveConfig = !!activeConfig;

    if (!hasActiveConfig) {
      errors.push('No active configuration found');
      recommendations.push('Create and publish a configuration for this stage');
      return {
        stage,
        hasActiveConfig: false,
        configValid: false,
        errors,
        recommendations,
      };
    }

    // 验证配置
    const validation = this.validateStepConfig(stage, activeConfig);
    errors.push(...validation.errors);

    // 生成建议
    if (validation.isValid) {
      recommendations.push('Configuration is valid and ready to use');
    } else {
      recommendations.push('Fix the validation errors above');
      recommendations.push(
        'Consider updating the configuration to include all required variables',
      );
    }

    return {
      stage,
      hasActiveConfig,
      configValid: validation.isValid,
      errors,
      recommendations,
    };
  }

  /**
   * 批量验证所有阶段的配置
   */
  async validateAllStageConfigs(): Promise<{
    total: number;
    valid: number;
    invalid: number;
    reports: Array<{
      stage: JobStage;
      hasActiveConfig: boolean;
      configValid: boolean;
      errors: string[];
      recommendations: string[];
    }>;
  }> {
    const stages: JobStage[] = [
      JobStage.PLAN,
      JobStage.OUTLINE,
      JobStage.STORYBOARD,
      JobStage.PAGES,
      JobStage.DONE,
    ];

    const reports = await Promise.all(
      stages.map((stage) => this.getStepConfigReport(stage)),
    );

    const valid = reports.filter((report) => report.configValid).length;
    const invalid = reports.length - valid;

    return {
      total: reports.length,
      valid,
      invalid,
      reports,
    };
  }
}
