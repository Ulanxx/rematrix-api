import { Injectable, Logger } from '@nestjs/common';
import {
  JobStage,
  ArtifactType,
  JobStatus,
  ApprovalStatus,
} from '@prisma/client';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import {
  StepDefinition,
  StepExecutionResult,
  ExecutionContext,
  validateStepDefinition,
} from './step-definition.interface';
import { StepRegistryService } from './step-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromptopsService } from '../promptops/promptops.service';
import { sha256 } from '../../utils/promptops-utils';
import { uploadJsonToBunny } from '../../utils/bunny-storage';
import { CreateJobDto } from '../jobs/dto/create-job.dto';

/**
 * Step 执行服务
 * 提供统一的步骤执行逻辑，支持 AI 生成、处理和合并类型的步骤
 */
@Injectable()
export class StepExecutorService {
  private readonly logger = new Logger(StepExecutorService.name);

  constructor(
    private readonly stepRegistry: StepRegistryService,
    private readonly prisma: PrismaService,
    private readonly promptopsService: PromptopsService,
  ) {}

  /**
   * 执行指定的工作流步骤
   */
  async execute(
    stage: JobStage,
    jobId: string,
    config?: CreateJobDto,
  ): Promise<StepExecutionResult> {
    this.logger.log(`Executing step ${stage} for job ${jobId}`);

    try {
      // 获取步骤定义
      const stepDef = this.stepRegistry.get(stage);
      if (!stepDef) {
        throw new Error(`No step definition found for stage: ${stage}`);
      }

      // 验证步骤定义
      const validation = validateStepDefinition(stepDef);
      if (!validation.isValid) {
        throw new Error(
          `Invalid step definition: ${validation.errors.join(', ')}`,
        );
      }

      // 准备执行上下文
      const context: ExecutionContext = {
        jobId,
        apiKey: process.env.OPENROUTER_API_KEY || '',
        prisma: this.prisma,
        promptopsService: this.promptopsService,
      };

      // 收集前面步骤的 AI response context
      context.previousStepsContext = await this.collectPreviousStepsContext(
        stepDef,
        jobId,
      );

      // 确保任务存在
      await this.ensureJob(jobId);

      // 检查是否已有有效结果
      const existingResult = await this.getExistingResult(stage, jobId);
      if (existingResult) {
        this.logger.log(`Using existing result for ${stage} of job ${jobId}`);
        return { success: true, output: existingResult };
      }

      // 准备输入数据
      const inputData: Record<string, unknown> = await this.prepareInput(
        stepDef,
        jobId,
        config,
      );

      // 执行步骤
      let result: unknown;
      const metadata: Record<string, unknown> = {};

      if (stepDef.type === 'AI_GENERATION') {
        const aiResult = await this.executeAIStep(stepDef, inputData, context);
        result = aiResult.output;
        Object.assign(metadata, aiResult.metadata);
      } else if (stepDef.type === 'PROCESSING') {
        const processingResult = await this.executeProcessingStep(
          stepDef,
          inputData,
          context,
        );
        result = processingResult.output;
        Object.assign(metadata, processingResult.metadata);
      } else {
        throw new Error(`Unsupported step type: ${String(stepDef.type)}`);
      }

      // 验证输出
      const outputValidation = stepDef.output.schema.safeParse(result);
      if (!outputValidation.success) {
        throw new Error(
          `Output validation failed: ${outputValidation.error.message}`,
        );
      }

      // 保存结果
      await this.saveResult(stepDef, jobId, result, metadata);

      // 处理审批逻辑
      if (stepDef.execution.requiresApproval) {
        await this.createApprovalRequest(jobId, stage);
        await this.updateJobStatus(jobId, JobStatus.WAITING_APPROVAL, stage);
      } else {
        await this.updateJobStatus(jobId, JobStatus.RUNNING, stage);
      }

      this.logger.log(`Successfully executed step ${stage} for job ${jobId}`);

      return {
        success: true,
        output: result,
        metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute step ${stage} for job ${jobId}`,
        error,
      );

      // 更新任务状态为失败
      await this.updateJobStatus(
        jobId,
        JobStatus.FAILED,
        stage,
        error instanceof Error ? error.message : String(error),
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 执行 AI 生成步骤
   */
  private async executeAIStep(
    stepDef: StepDefinition,
    inputData: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<{ output: unknown; metadata: Record<string, unknown> }> {
    if (!stepDef.aiConfig) {
      throw new Error('AI_GENERATION step must have aiConfig');
    }

    // 获取活跃的 prompt 配置
    const activeConfig = await this.promptopsService.getActiveConfig(
      stepDef.stage,
    );
    const config = activeConfig || stepDef.aiConfig;

    // 构建完整的 prompt，包含前面步骤的 context
    const fullPrompt = this.buildPromptWithContext(
      config.prompt,
      inputData,
      context.previousStepsContext || {},
      stepDef.stage,
    );

    console.log(`🔍 Debug Info for ${stepDef.stage}:`);
    console.log('🔍 Input Data:', JSON.stringify(inputData, null, 2));
    console.log(
      '🔍 Previous Steps Context:',
      JSON.stringify(context.previousStepsContext, null, 2),
    );
    console.log('🔍 Full Prompt:', fullPrompt);
    console.log(
      '🔍 Expected Schema:',
      JSON.stringify(stepDef.output.schema, null, 2),
    );

    // 创建 OpenAI 客户端
    const openai = createOpenAI({
      apiKey: context.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    const model = openai(config.model);

    // 执行 AI 生成
    const rawResponse = await generateObject({
      model,
      temperature: config.temperature ?? undefined,
      schema: stepDef.output.schema,
      prompt: fullPrompt,
    });

    console.log('🔍 AI Raw Response:', JSON.stringify(rawResponse, null, 2));
    console.log(
      '🔍 Generated Object:',
      JSON.stringify(rawResponse.object, null, 2),
    );

    // 验证生成的对象是否符合 schema
    try {
      const validationResult = stepDef.output.schema.safeParse(
        rawResponse.object,
      );
      if (!validationResult.success) {
        console.error('❌ Schema validation failed:', validationResult.error);
        console.error(
          '❌ Error details:',
          JSON.stringify(validationResult.error.issues, null, 2),
        );
        console.error(
          '❌ AI Raw Response that failed validation:',
          JSON.stringify(rawResponse, null, 2),
        );

        // 创建包含原始返回值的错误信息
        const errorMessage = `Schema validation failed: ${validationResult.error.message}. Original AI response: ${JSON.stringify(rawResponse.object)}`;
        throw new Error(errorMessage);
      } else {
        console.log('✅ Schema validation passed');
      }
    } catch (error) {
      console.error('❌ Schema validation error:', error);
      throw error;
    }

    const { object } = rawResponse as { object: unknown };

    return {
      output: object,
      metadata: {
        model: config.model,
        temperature: config.temperature,
        promptConfigId: activeConfig?.id ?? null,
        generationType: 'ai',
      },
    };
  }

  /**
   * 执行处理步骤
   */
  private async executeProcessingStep(
    stepDef: StepDefinition,
    inputData: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<{ output: unknown; metadata: Record<string, unknown> }> {
    if (stepDef.customExecute) {
      const result = (await stepDef.customExecute(
        inputData,
        context,
      )) as unknown;
      return {
        output: result,
        metadata: {
          generationType: 'custom_processing',
        },
      };
    }

    throw new Error(
      `PROCESSING step ${stepDef.stage} must implement customExecute`,
    );
  }

  /**
   * 构建包含前面步骤 context 的 prompt
   */
  private buildPromptWithContext(
    basePrompt: string,
    inputData: Record<string, unknown>,
    previousStepsContext: Record<string, unknown>,
    stage: JobStage,
  ): string {
    let prompt = basePrompt;

    // 然后根据阶段添加特定的输入数据
    switch (stage) {
      case 'PLAN':
        if (typeof inputData.originContent === 'string') {
          prompt += `\n\n# Markdown\n${inputData.originContent}`;
        }
        break;
      case 'OUTLINE':
        if (typeof inputData.originContent === 'string') {
          prompt += `\n\n# Markdown\n${inputData.originContent}`;
        }
        if (inputData.plan && typeof inputData.plan === 'object') {
          prompt += `\n\n# PLAN(JSON)\n${JSON.stringify(inputData.plan, null, 2)}`;
        }
        break;
      case 'STORYBOARD':
        if (inputData.outline && typeof inputData.outline === 'object') {
          prompt += `\n\n# OUTLINE(JSON)\n${JSON.stringify(inputData.outline, null, 2)}`;
        }
        break;
      case 'PAGES':
        if (inputData.storyboard && typeof inputData.storyboard === 'object') {
          prompt += `\n\n# STORYBOARD(JSON)\n${JSON.stringify(inputData.storyboard, null, 2)}`;
        }
        break;
      default:
        // 对于其他阶段，添加所有可用的输入数据
        for (const [key, value] of Object.entries(inputData)) {
          if (value !== undefined && value !== null) {
            if (typeof value === 'object') {
              prompt += `\n\n# ${key.toUpperCase()}\n${JSON.stringify(value, null, 2)}`;
            } else if (typeof value === 'string') {
              prompt += `\n\n# ${key.toUpperCase()}\n${value}`;
            }
          }
        }
    }

    return prompt;
  }

  /**
   * 准备输入数据
   */
  private async prepareInput(
    stepDef: StepDefinition,
    jobId: string,
    config?: CreateJobDto,
  ): Promise<Record<string, unknown>> {
    // 如果有自定义输入准备逻辑，使用自定义逻辑
    if (stepDef.customPrepareInput) {
      const customInput = (await stepDef.customPrepareInput(
        jobId,
        {
          jobId,
          apiKey: process.env.OPENROUTER_API_KEY || '',
          prisma: this.prisma,
          promptopsService: this.promptopsService,
        },
        config?.content,
      )) as Record<string, unknown>;

      // 验证自定义输入
      const inputValidation = stepDef.input.schema.safeParse(customInput);
      if (!inputValidation.success) {
        throw new Error(
          `Input validation failed: ${inputValidation.error.message}`,
        );
      }

      return customInput;
    }

    // 默认输入准备逻辑
    const inputData: Record<string, unknown> = {};

    // 添加 markdown（如果提供）
    if (config?.content) {
      inputData.originContent = config.content;
    }

    // 从依赖阶段获取数据
    for (const sourceStage of stepDef.input.sources) {
      const artifact = await this.getLatestJsonArtifact(jobId, sourceStage);
      if (artifact) {
        inputData[sourceStage.toLowerCase()] = artifact.content;
      }
    }

    // 验证输入
    const inputValidation = stepDef.input.schema.safeParse(inputData);
    if (!inputValidation.success) {
      throw new Error(
        `Input validation failed: ${inputValidation.error.message}`,
      );
    }

    return inputData;
  }

  /**
   * 收集前面步骤的 AI response context
   */
  private async collectPreviousStepsContext(
    stepDef: StepDefinition,
    jobId: string,
  ): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = {};

    // 定义步骤执行顺序
    const stageOrder = ['PLAN', 'OUTLINE', 'STORYBOARD', 'PAGES', 'DONE'];

    const currentStageIndex = stageOrder.indexOf(stepDef.stage);

    // 收集所有前面步骤的 AI response
    for (let i = 0; i < currentStageIndex; i++) {
      const previousStage = stageOrder[i] as JobStage;
      const artifact = await this.getLatestJsonArtifact(jobId, previousStage);

      if (artifact?.content) {
        context[previousStage.toLowerCase()] = artifact.content;
      }
    }

    return context;
  }

  /**
   * 获取最新的 JSON artifact
   */
  private async getLatestJsonArtifact(jobId: string, stage: JobStage) {
    return await this.prisma.artifact.findFirst({
      where: {
        jobId,
        stage,
        type: ArtifactType.JSON,
      },
      orderBy: { version: 'desc' },
      select: { version: true, content: true },
    });
  }

  /**
   * 获取现有结果
   */
  private async getExistingResult(stage: JobStage, jobId: string) {
    // 检查是否已有结果且已审批（如果需要审批）
    const artifact = await this.getLatestJsonArtifact(jobId, stage);
    if (!artifact?.content) {
      return null;
    }

    // 如果需要审批，检查审批状态
    const stepDef = this.stepRegistry.get(stage);
    if (stepDef?.execution.requiresApproval) {
      const approval = await this.prisma.approval.findUnique({
        where: { jobId_stage: { jobId, stage } },
        select: { status: true },
      });

      if (!approval || approval.status !== ApprovalStatus.APPROVED) {
        return null;
      }
    }

    // 检查任务当前阶段是否已通过此阶段
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { currentStage: true },
    });

    if (job) {
      const stageOrder = ['PLAN', 'OUTLINE', 'STORYBOARD', 'PAGES', 'DONE'];
      const currentIndex = stageOrder.indexOf(job.currentStage);
      const stageIndex = stageOrder.indexOf(stage);

      if (currentIndex >= stageIndex) {
        return artifact.content;
      }
    }

    return null;
  }

  /**
   * 保存结果
   */
  private async saveResult(
    stepDef: StepDefinition,
    jobId: string,
    result: unknown,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    // 计算版本号
    const latest = await this.prisma.artifact.findFirst({
      where: { jobId, stage: stepDef.stage, type: stepDef.output.type },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    // 准备元数据
    const inputsHash = sha256(
      JSON.stringify({
        stage: stepDef.stage,
        jobId,
        timestamp: Date.now(),
      }),
    );

    const finalMetadata = {
      inputsHash,
      ...metadata,
      stepType: stepDef.type,
      generatedAt: new Date().toISOString(),
    };

    // 上传到云存储（如果是 JSON）
    let blobUrl: string | null = null;
    if (stepDef.output.type === ArtifactType.JSON) {
      try {
        const path = `jobs/${jobId}/artifacts/${stepDef.stage}/v${nextVersion}.json`;
        const uploaded = await uploadJsonToBunny({ path, json: result });
        blobUrl = uploaded.publicUrl ?? uploaded.storageUrl;
      } catch (error) {
        this.logger.warn(`Failed to upload artifact to cloud storage`, error);
      }
    }

    // 保存到数据库
    await this.prisma.artifact.create({
      data: {
        jobId,
        stage: stepDef.stage,
        type: stepDef.output.type,
        version: nextVersion,
        content: result as any,
        blobUrl,
        meta: finalMetadata as any,
        createdBy: 'system',
      },
    });
  }

  /**
   * 创建审批请求
   */
  private async createApprovalRequest(
    jobId: string,
    stage: JobStage,
  ): Promise<void> {
    await this.prisma.approval.upsert({
      where: { jobId_stage: { jobId, stage } },
      update: { status: ApprovalStatus.PENDING, comment: null },
      create: {
        jobId,
        stage,
        status: ApprovalStatus.PENDING,
      },
    });
  }

  /**
   * 确保任务存在
   */
  private async ensureJob(jobId: string): Promise<void> {
    await this.prisma.job.upsert({
      where: { id: jobId },
      update: {},
      create: {
        id: jobId,
        status: JobStatus.DRAFT,
        currentStage: JobStage.PLAN,
      },
    });
  }

  /**
   * 更新任务状态
   */
  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    currentStage: JobStage,
    error?: string,
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      currentStage,
    };

    if (error) {
      updateData.error = error;
    }

    await this.prisma.job.update({
      where: { id: jobId },
      data: updateData,
    });
  }
}
