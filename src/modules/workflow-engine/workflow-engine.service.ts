import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PrismaService } from '../prisma/prisma.service';
import { TemporalClientService } from '../temporal/temporal-client.service';
import { JobStage } from '@prisma/client';
import { WORKFLOW_COMMANDS, isValidStage, normalizeStage } from './commands';

/**
 * 工作流状态更新事件接口
 */
export interface WorkflowStatusUpdateEvent {
  jobId: string;
  status: string;
  currentStage: string;
  completedStages: string[];
  timestamp: string;
  progress?: number;
  error?: string;
}

/**
 * 工作流阶段完成事件接口
 */
export interface WorkflowStageCompletedEvent {
  jobId: string;
  stage: string;
  nextStage?: string;
  timestamp: string;
}

/**
 * 工作流错误事件接口
 */
export interface WorkflowErrorEvent {
  jobId: string;
  error: string;
  stage?: string;
  timestamp: string;
}

/**
 * 工作流指令请求接口
 */
export interface WorkflowCommandRequest {
  /** 任务 ID */
  jobId: string;
  /** 指令名称 */
  command: string;
  /** 指令参数 */
  params?: Record<string, unknown>;
}

/**
 * 工作流指令执行结果接口
 */
export interface WorkflowCommandResult {
  /** 是否执行成功 */
  success: boolean;
  /** 执行结果消息 */
  message: string;
  /** 额外的结果数据 */
  data?: Record<string, unknown>;
}

/**
 * 工作流引擎服务
 *
 * 负责解析和执行工作流控制指令，支持指令格式和自然语言两种输入方式。
 * 提供任务状态控制、阶段跳转、参数修改等功能。
 */
@Injectable()
export class WorkflowEngineService {
  /**
   * 事件发射器，用于通知 WebSocket 客户端工作流状态变更
   */
  public readonly eventEmitter = new EventEmitter();

  /**
   * 构造函数
   *
   * @param prisma - Prisma 数据库服务
   * @param temporal - Temporal 工作流客户端服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly temporal: TemporalClientService,
  ) {}

  /**
   * 执行工作流指令
   *
   * @param request - 工作流指令请求
   * @returns 指令执行结果
   * @throws BadRequestException 当指令不存在或参数无效时抛出
   *
   * 执行流程：
   * 1. 验证指令是否存在
   * 2. 创建指令记录到数据库
   * 3. 根据指令类型调用相应的处理方法
   * 4. 更新指令执行状态
   * 5. 返回执行结果
   *
   * @example
   * ```typescript
   * const result = await workflowEngine.executeCommand({
   *   jobId: 'job_123',
   *   command: 'pause'
   * });
   * console.log(result.message); // 'Job paused successfully'
   * ```
   */
  async executeCommand(
    request: WorkflowCommandRequest,
  ): Promise<WorkflowCommandResult> {
    const { jobId, command, params } = request;

    // 验证指令是否存在
    if (!WORKFLOW_COMMANDS[command]) {
      throw new BadRequestException(`Unknown command: ${command}`);
    }

    // 创建指令记录
    const workflowCommand = await (this.prisma as any).workflowCommand.create({
      data: {
        jobId,
        command,
        params: params || null,
        status: 'EXECUTING',
      },
    });

    try {
      let result: WorkflowCommandResult;

      switch (command) {
        case 'run':
          result = await this.handleRun(jobId);
          break;
        case 'pause':
          result = await this.handlePause(jobId);
          break;
        case 'resume':
          result = await this.handleResume(jobId);
          break;
        case 'jump-to':
          result = await this.handleJumpTo(jobId, params);
          break;
        case 'modify-stage':
          result = this.handleModifyStage(jobId, params);
          break;
        default:
          throw new BadRequestException(`Command not implemented: ${command}`);
      }

      // 更新指令状态为成功
      await (this.prisma as any).workflowCommand.update({
        where: { id: workflowCommand.id },
        data: {
          status: 'SUCCESS',
          result: result.data || null,
        },
      });

      return result;
    } catch (error) {
      // 更新指令状态为失败
      await (this.prisma as any).workflowCommand.update({
        where: { id: workflowCommand.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  /**
   * 处理运行指令
   *
   * @param jobId - 任务 ID
   * @returns 执行结果
   * @throws BadRequestException 当任务不存在或配置无效时抛出
   */
  private async handleRun(jobId: string): Promise<WorkflowCommandResult> {
    const job = await (this.prisma as any).job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new BadRequestException('Job not found');
    }

    if (job.status === 'RUNNING') {
      return {
        success: true,
        message: 'Job is already running',
      };
    }

    // 获取 Job 的 content 配置
    const config = job.config as {
      content?: string;
      style?: string;
      language?: string;
    } | null;
    const content = config?.content;

    if (!content) {
      throw new BadRequestException('job.config.content is missing');
    }

    // 启动或恢复 Job 执行
    await this.temporal.startVideoGeneration({
      jobId,
      config: { content, style: config?.style, language: config?.language },
    });

    // 发射状态更新事件
    this.emitStatusUpdate(
      jobId,
      'RUNNING',
      job.currentStage || 'PLAN',
      job.completedStages || [],
    );

    return {
      success: true,
      message: 'Job execution started',
      data: { status: 'RUNNING' },
    };
  }

  /**
   * 处理暂停指令
   *
   * @param jobId - 任务 ID
   * @returns 执行结果
   * @throws BadRequestException 当任务不存在或状态不允许暂停时抛出
   */
  private async handlePause(jobId: string): Promise<WorkflowCommandResult> {
    const job = await (this.prisma as any).job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new BadRequestException('Job not found');
    }

    if (job.status === ('PAUSED' as string)) {
      return {
        success: true,
        message: 'Job is already paused',
      };
    }

    if (job.status !== 'RUNNING') {
      throw new BadRequestException('Cannot pause a job that is not running');
    }

    // 更新 Job 状态为暂停
    await (this.prisma as any).job.update({
      where: { id: jobId },
      data: { status: 'PAUSED' },
    });

    // 发射状态更新事件
    this.emitStatusUpdate(
      jobId,
      'PAUSED',
      job.currentStage || 'PLAN',
      job.completedStages || [],
    );

    return {
      success: true,
      message: 'Job paused successfully',
      data: { status: 'PAUSED' },
    };
  }

  /**
   * 处理恢复指令
   *
   * @param jobId - 任务 ID
   * @returns 执行结果
   * @throws BadRequestException 当任务不存在或状态不允许恢复时抛出
   */
  private async handleResume(jobId: string): Promise<WorkflowCommandResult> {
    const job = await (this.prisma as any).job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new BadRequestException('Job not found');
    }

    if (job.status === 'RUNNING') {
      return {
        success: true,
        message: 'Job is already running',
      };
    }

    if (job.status !== ('PAUSED' as string)) {
      throw new BadRequestException('Cannot resume a job that is not paused');
    }

    // 获取 Job 的 content 配置
    const config = job.config as {
      content?: string;
      style?: string;
      language?: string;
    } | null;
    const content = config?.content;

    if (!content) {
      throw new BadRequestException('job.config.content is missing');
    }

    // 恢复 Job 执行
    await this.temporal.startVideoGeneration({
      jobId,
      config: { content, style: config?.style, language: config?.language },
    });

    // 发射状态更新事件
    this.emitStatusUpdate(
      jobId,
      'RUNNING',
      job.currentStage || 'PLAN',
      job.completedStages || [],
    );

    return {
      success: true,
      message: 'Job resumed successfully',
      data: { status: 'RUNNING' },
    };
  }

  /**
   * 处理跳转到指定阶段指令
   *
   * @param jobId - 任务 ID
   * @param params - 指令参数，必须包含 stage
   * @returns 执行结果
   * @throws BadRequestException 当参数无效或阶段不存在时抛出
   */
  private async handleJumpTo(
    jobId: string,
    params?: Record<string, unknown>,
  ): Promise<WorkflowCommandResult> {
    const stage = params?.stage as string;

    if (!stage) {
      throw new BadRequestException(
        'Stage parameter is required for jump-to command',
      );
    }

    // 验证阶段是否有效
    if (!isValidStage(stage)) {
      throw new BadRequestException(
        `Invalid stage: ${stage}. Valid stages: ${Object.values(JobStage).join(', ')}`,
      );
    }

    // 更新 Job 当前阶段
    const normalizedStage = normalizeStage(stage);
    await (this.prisma as any).job.update({
      where: { id: jobId },
      data: { currentStage: normalizedStage },
    });

    return {
      success: true,
      message: `Jumped to stage: ${normalizedStage}`,
      data: { currentStage: normalizedStage },
    };
  }

  /**
   * 处理修改阶段参数指令
   *
   * @param jobId - 任务 ID
   * @param params - 指令参数，必须包含 stage 和 modifications
   * @returns 执行结果
   * @throws BadRequestException 当参数无效时抛出
   *
   * 注意：当前实现只是简单返回成功，实际修改逻辑需要根据具体需求实现
   */
  private handleModifyStage(
    jobId: string,
    params?: Record<string, unknown>,
  ): WorkflowCommandResult {
    const stage = params?.stage as string;
    const modifications = params?.modifications as Record<string, unknown>;

    if (!stage || !modifications) {
      throw new BadRequestException(
        'Stage and modifications parameters are required for modify-stage command',
      );
    }

    // 验证阶段是否有效
    if (!isValidStage(stage)) {
      throw new BadRequestException(`Invalid stage: ${stage}`);
    }

    // 这里可以实现阶段参数修改逻辑
    // 目前简单返回成功，实际实现需要根据具体需求
    return {
      success: true,
      message: `Stage ${stage} modified successfully`,
      data: { stage, modifications },
    };
  }

  /**
   * 获取指定任务的指令执行历史
   *
   * @param jobId - 任务 ID
   * @returns 最近 10 条指令记录，按创建时间倒序排列
   *
   * @example
   * ```typescript
   * const history = await workflowEngine.getCommandHistory('job_123');
   * console.log(history); // [{ command, status, createdAt, ... }]
   * ```
   */
  async getCommandHistory(jobId: string) {
    return await (this.prisma as any).workflowCommand.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      take: 10, // Return the last 10 commands
    });
  }

  /**
   * 解析指令格式的文本
   *
   * @param message - 用户输入的指令文本，必须以 '/' 开头
   * @returns 解析结果，包含指令名和参数，如果无法解析则返回 null
   *
   * 支持的指令格式：
   * - `/run` - 运行任务
   * - `/pause` - 暂停任务
   * - `/resume` - 恢复任务
   * - `/jump-to STAGE` - 跳转到指定阶段
   * - `/modify-stage STAGE key=value` - 修改阶段参数
   *
   * @example
   * ```typescript
   * const result = workflowEngine.parseCommand('/jump-to NARRATION');
   * console.log(result); // { command: 'jump-to', params: { stage: 'NARRATION' } }
   * ```
   */
  parseCommand(
    message: string,
  ): { command: string; params?: Record<string, unknown> } | null {
    // 检查是否为指令格式
    if (!message.startsWith('/')) {
      return null;
    }

    const parts = message.trim().split(' ');
    const command = parts[0].substring(1); // 移除 '/'

    if (parts.length === 1) {
      return { command };
    }

    // 简单的参数解析
    const params: Record<string, unknown> = {};

    // 处理 jump-to STAGE 格式
    if (command === 'jump-to' && parts[1]) {
      params.stage = parts[1];
    }

    // 处理 modify-stage STAGE key=value 格式
    if (command === 'modify-stage' && parts.length >= 3) {
      params.stage = parts[1];
      const keyValue = parts[2].split('=');
      if (keyValue.length === 2) {
        params.modifications = { [keyValue[0]]: keyValue[1] };
      }
    }

    return { command, params };
  }

  /**
   * 解析自然语言格式的文本
   *
   * @param message - 用户输入的自然语言文本
   * @returns 解析结果，包含指令名和参数，如果无法解析则返回 null
   *
   * 支持的自然语言模式：
   * - "运行任务" / "开始执行" -> run
   * - "暂停任务" / "停止一下" -> pause
   * - "继续执行" / "恢复任务" -> resume
   * - "跳到口播阶段" / "直接进入分镜" -> jump-to
   * - "修改渲染参数" -> modify-stage
   *
   * @example
   * ```typescript
   * const result = workflowEngine.parseNaturalLanguage('跳到口播阶段');
   * console.log(result); // { command: 'jump-to', params: { stage: 'NARRATION' } }
   * ```
   */
  parseNaturalLanguage(
    message: string,
  ): { command: string; params?: Record<string, unknown> } | null {
    const lowerMessage = message.toLowerCase();

    // 遍历所有指令的自然语言模式
    for (const [command, definition] of Object.entries(WORKFLOW_COMMANDS)) {
      for (const pattern of definition.naturalLanguagePatterns) {
        if (pattern.test(lowerMessage)) {
          const params: Record<string, unknown> = {};

          // 提取阶段信息
          const stageMatch = lowerMessage.match(
            /(plan|outline|narration|pages|done)/,
          );
          if (
            stageMatch &&
            (command === 'jump-to' || command === 'modify-stage')
          ) {
            params.stage = normalizeStage(stageMatch[1]);
          }

          return { command, params };
        }
      }
    }

    return null;
  }

  /**
   * 获取所有可用的工作流指令
   *
   * @returns 指令定义对象，包含所有支持的指令及其自然语言模式
   *
   * @example
   * ```typescript
   * const commands = workflowEngine.getAvailableCommands();
   * console.log(Object.keys(commands)); // ['run', 'pause', 'resume', 'jump-to', 'modify-stage']
   * ```
   */
  getAvailableCommands() {
    return WORKFLOW_COMMANDS;
  }

  /**
   * 发射工作流状态更新事件
   */
  private emitStatusUpdate(
    jobId: string,
    status: string,
    currentStage: string,
    completedStages: string[],
    error?: string,
  ) {
    const event: WorkflowStatusUpdateEvent = {
      jobId,
      status,
      currentStage,
      completedStages,
      timestamp: new Date().toISOString(),
      error,
    };

    this.eventEmitter.emit('workflow.status.update', event);
  }

  /**
   * 发射工作流阶段完成事件
   */
  emitStageCompleted(jobId: string, stage: string, nextStage?: string) {
    const event: WorkflowStageCompletedEvent = {
      jobId,
      stage,
      nextStage,
      timestamp: new Date().toISOString(),
    };

    this.eventEmitter.emit('workflow.stage.completed', event);
  }

  /**
   * 发射工作流错误事件
   */
  emitWorkflowError(jobId: string, error: string, stage?: string) {
    const event: WorkflowErrorEvent = {
      jobId,
      error,
      stage,
      timestamp: new Date().toISOString(),
    };

    this.eventEmitter.emit('workflow.error', event);
  }
}
