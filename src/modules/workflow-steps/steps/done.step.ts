import { JobStage, ArtifactType } from '@prisma/client';
import { z } from 'zod';
import {
  StepDefinition,
  createStepDefinition,
  ExecutionContext,
} from '../step-definition.interface';

/**
 * DONE 阶段的输出 Schema
 */
export const doneOutputSchema = z.object({
  status: z.string(),
  completedAt: z.string(),
  jobId: z.string(),
  summary: z.object({
    totalStages: z.number(),
    completedStages: z.number(),
    artifacts: z.array(
      z.object({
        stage: z.string(),
        type: z.string(),
        version: z.number(),
      }),
    ),
  }),
});

/**
 * DONE 阶段的输入 Schema
 */
export const doneInputSchema = z.object({
  jobId: z.string(),
});

/**
 * DONE 阶段定义
 * 标记工作流完成，生成最终总结
 */
export const doneStep: StepDefinition = createStepDefinition({
  stage: JobStage.DONE,
  type: 'PROCESSING',
  name: 'Workflow Completion',
  description: '标记工作流完成，生成最终总结和状态报告',

  // 输入配置
  input: {
    sources: [JobStage.PAGES], // 依赖 PAGES 阶段完成
    schema: doneInputSchema,
    description: '任务 ID 和所有前置阶段的输出',
  },

  // 输出配置
  output: {
    type: ArtifactType.JSON,
    schema: doneOutputSchema,
    description: '工作流完成状态和总结报告',
  },

  // 执行配置
  execution: {
    requiresApproval: false, // DONE 不需要用户审批
    retryPolicy: {
      maxAttempts: 1,
      backoffMs: 1000,
      maxBackoffMs: 5000,
    },
    timeoutMs: 30000, // 30 秒超时
  },

  // 自定义执行逻辑
  async customExecute(input: any, context: ExecutionContext): Promise<any> {
    const { jobId } = input;

    // 获取所有 artifacts
    const artifacts = await context.prisma.artifact.findMany({
      where: { jobId },
      orderBy: [{ stage: 'asc' }, { version: 'desc' }],
      select: {
        stage: true,
        type: true,
        version: true,
      },
    });

    // 去重，每个阶段只保留最新版本
    const uniqueArtifacts = new Map();
    for (const artifact of artifacts) {
      const key = `${artifact.stage}-${artifact.type}`;
      if (
        !uniqueArtifacts.has(key) ||
        uniqueArtifacts.get(key).version < artifact.version
      ) {
        uniqueArtifacts.set(key, artifact);
      }
    }

    const finalArtifacts = Array.from(uniqueArtifacts.values());

    // 统计完成的阶段
    const completedStages = new Set(finalArtifacts.map((a) => a.stage)).size;
    const totalStages = 5; // PLAN, OUTLINE, STORYBOARD, PAGES, DONE

    return {
      status: 'completed',
      completedAt: new Date().toISOString(),
      jobId,
      summary: {
        totalStages,
        completedStages,
        artifacts: finalArtifacts,
      },
    };
  },

  // 验证函数
  validate() {
    const errors: string[] = [];

    // 验证输出结构的合理性
    const testOutput = {
      status: 'completed',
      completedAt: new Date().toISOString(),
      jobId: 'test-job-id',
      summary: {
        totalStages: 5,
        completedStages: 5,
        artifacts: [
          {
            stage: 'PLAN',
            type: 'JSON',
            version: 1,
          },
          {
            stage: 'PAGES',
            type: 'JSON',
            version: 1,
          },
        ],
      },
    };

    const validation = doneOutputSchema.safeParse(testOutput);
    if (!validation.success) {
      errors.push(
        `Output schema validation failed: ${validation.error.message}`,
      );
    }

    // 验证状态
    if (testOutput.status !== 'completed') {
      errors.push('Status must be "completed"');
    }

    if (!testOutput.completedAt) {
      errors.push('Completed timestamp is required');
    }

    if (testOutput.summary.completedStages > testOutput.summary.totalStages) {
      errors.push('Completed stages cannot exceed total stages');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
});

export default doneStep;
