import {
  BadRequestException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { ApprovalStatus, JobStage, JobStatus } from '@prisma/client';
import { ChatMessagesService } from '../chat-messages/chat-messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { TemporalClientService } from '../temporal/temporal-client.service';
import { CreateJobDto } from './dto/create-job.dto';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

/**
 * 任务服务
 *
 * 负责管理视频生成任务的生命周期，包括创建、启动、审批和状态管理。
 * 与 Temporal 工作流引擎协作，处理任务的异步执行和人工干预。
 */
@Injectable()
export class JobsService {
  /**
   * 构造函数
   *
   * @param prisma - Prisma 数据库服务
   * @param temporal - Temporal 工作流客户端服务
   * @param chatMessages - 聊天消息服务
   * @param workflowEngine - 工作流引擎服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly temporal: TemporalClientService,
    public readonly chatMessages: ChatMessagesService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  /**
   * 异步等待工具方法
   *
   * @param ms - 等待的毫秒数
   * @returns Promise<void>
   */
  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 创建新的视频生成任务
   *
   * @param dto - 创建任务的 DTO，包含 Markdown 内容和其他配置
   * @returns 创建的任务对象
   * @throws BadRequestException 当 Markdown 内容为空时抛出
   *
   * @example
   * ```typescript
   * const job = await jobsService.create({
   *   content: '# 深度学习入门\n\n这是一个教程...'
   * });
   * ```
   */
  async create(dto: CreateJobDto) {
    if (!dto.content) {
      throw new BadRequestException('content is required');
    }

    const job = await this.prisma.job.create({
      data: {
        status: JobStatus.DRAFT,
        currentStage: JobStage.PLAN,
        config: {
          content: dto.content,
          style: dto.style,
          language: dto.language,
        },
      },
    });

    return job;
  }

  /**
   * 获取任务列表
   *
   * @returns 任务列表，按创建时间倒序排列，只包含基本信息
   *
   * @example
   * ```typescript
   * const jobs = await jobsService.list();
   * console.log(jobs); // [{ id, status, currentStage, createdAt, ... }]
   * ```
   */
  async list() {
    return await this.prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        currentStage: true,
        createdAt: true,
        updatedAt: true,
        error: true,
      },
    });
  }

  /**
   * 获取指定任务的详细信息
   *
   * @param jobId - 任务 ID
   * @returns 任务的完整信息，包括配置和状态
   * @throws NotFoundException 当任务不存在时抛出
   *
   * @example
   * ```typescript
   * const job = await jobsService.get('job_123');
   * console.log(job.config.content); // 访问 Markdown 内容
   * ```
   */
  async get(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('job not found');
    return job;
  }

  /**
   * 启动视频生成工作流
   *
   * @param jobId - 要启动的任务 ID
   * @returns Temporal 工作流启动结果
   * @throws BadRequestException 当任务配置缺少 Markdown 内容时抛出
   * @throws NotFoundException 当任务不存在时抛出
   *
   * @example
   * ```typescript
   * const result = await jobsService.run('job_123');
   * console.log('工作流已启动:', result.workflowId);
   * ```
   */
  async run(jobId: string) {
    const job = await this.get(jobId);
    const config = job.config as CreateJobDto | null;
    const content = config?.content;
    if (!content) {
      throw new BadRequestException('job.config.content is missing');
    }

    return this.temporal.startVideoGeneration({ jobId, config });
  }

  /**
   * 批准指定阶段的产物，继续执行工作流
   *
   * @param jobId - 任务 ID
   * @param stage - 要批准的阶段 (PLAN|PAGES)
   * @param comment - 可选的审批意见
   * @returns 审批结果，包含任务和审批信息
   * @throws NotFoundException 当任务不存在时抛出
   *
   * 该方法会：
   * 1. 向 Temporal 工作流发送批准信号
   * 2. 轮询等待审批状态更新（最多 20 秒）
   * 3. 返回最终的审批结果
   *
   * @example
   * ```typescript
   * const result = await jobsService.approve(
   *   'job_123',
   *   'PLAN',
   *   '计划看起来不错，继续执行'
   * );
   * if (result.ok) {
   *   console.log('审批通过，工作流继续执行');
   * }
   * ```
   */
  async approve(jobId: string, stage: string, comment?: string) {
    console.log('Approve comment:', comment);
    await this.get(jobId);
    await this.temporal.signalApprove({ jobId, stage });

    const startedAt = Date.now();
    const timeoutMs = 20000;
    const intervalMs = 200;

    while (Date.now() - startedAt < timeoutMs) {
      const [job, approval] = await Promise.all([
        this.prisma.job.findUnique({ where: { id: jobId } }),
        this.prisma.approval.findUnique({
          where: {
            jobId_stage: {
              jobId,
              stage: stage as JobStage,
            },
          },
        }),
      ]);

      if (
        approval?.status === ApprovalStatus.APPROVED &&
        job?.status === JobStatus.RUNNING
      ) {
        // 发射阶段完成事件
        this.workflowEngine.emitStageCompleted(jobId, stage);

        return { ok: true, job, approval };
      }

      await this.sleep(intervalMs);
    }

    const [job, approval] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: jobId } }),
      this.prisma.approval.findUnique({
        where: {
          jobId_stage: {
            jobId,
            stage: stage as JobStage,
          },
        },
      }),
    ]);

    return { ok: false, job, approval, timeout: true };
  }

  /**
   * 拒绝指定阶段的产物，工作流将重新生成该阶段
   *
   * @param jobId - 任务 ID
   * @param stage - 要拒绝的阶段 (PLAN|PAGES)
   * @param reason - 拒绝原因
   * @param comment - 可选的详细说明
   * @returns 拒绝结果，包含任务和审批信息
   * @throws NotFoundException 当任务不存在时抛出
   *
   * 该方法会：
   * 1. 向 Temporal 工作流发送拒绝信号
   * 2. 轮询等待拒绝状态更新（最多 20 秒）
   * 3. 工作流收到信号后会重新执行该阶段
   *
   * @example
   * ```typescript
   * const result = await jobsService.reject(
   *   'job_123',
   *   'PLAN',
   *   '口播稿不够详细，需要补充更多示例'
   * );
   * if (result.ok) {
   *   console.log('已拒绝，将重新生成口播稿');
   * }
   * ```
   */
  async reject(
    jobId: string,
    stage: string,
    reason?: string,
    comment?: string,
  ) {
    console.log('Reject comment:', comment);
    await this.get(jobId);
    await this.temporal.signalReject({ jobId, stage, reason });

    const startedAt = Date.now();
    const timeoutMs = 20000;
    const intervalMs = 200;

    while (Date.now() - startedAt < timeoutMs) {
      const [job, approval] = await Promise.all([
        this.prisma.job.findUnique({ where: { id: jobId } }),
        this.prisma.approval.findUnique({
          where: {
            jobId_stage: {
              jobId,
              stage: stage as JobStage,
            },
          },
        }),
      ]);

      if (
        approval?.status === ApprovalStatus.REJECTED &&
        job?.status === JobStatus.WAITING_APPROVAL
      ) {
        // 发射错误事件（拒绝审批）
        this.workflowEngine.emitWorkflowError(
          jobId,
          reason || `Stage ${stage} was rejected`,
          stage,
        );

        return { ok: true, job, approval };
      }

      await this.sleep(intervalMs);
    }

    const [job, approval] = await Promise.all([
      this.prisma.job.findUnique({ where: { id: jobId } }),
      this.prisma.approval.findUnique({
        where: {
          jobId_stage: {
            jobId,
            stage: stage as JobStage,
          },
        },
      }),
    ]);

    return { ok: true, job, approval, timeout: true };
  }

  /**
   * 检查任务是否可以暂停
   *
   * @param jobId - 任务 ID
   * @returns 是否可以暂停
   *
   * 只有正在运行中的任务才能暂停
   *
   * @example
   * ```typescript
   * const canPause = await jobsService.canPause('job_123');
   * if (canPause) {
   *   await jobsService.pause('job_123');
   * }
   * ```
   */
  async canPause(jobId: string): Promise<boolean> {
    const job = await this.get(jobId);
    return job.status === JobStatus.RUNNING;
  }

  /**
   * 检查任务是否可以恢复
   *
   * @param jobId - 任务 ID
   * @returns 是否可以恢复
   *
   * 只有已暂停的任务才能恢复
   *
   * @example
   * ```typescript
   * const canResume = await jobsService.canResume('job_123');
   * if (canResume) {
   *   await jobsService.resume('job_123');
   * }
   * ```
   */
  async canResume(jobId: string): Promise<boolean> {
    const job = await this.get(jobId);
    return job.status === ('PAUSED' as string);
  }
}
