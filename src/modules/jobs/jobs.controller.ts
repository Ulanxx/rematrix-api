import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import type { Response } from 'express';
import { ApproveJobDto } from './dto/approve-job.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { RejectJobDto } from './dto/reject-job.dto';
import { JobsService } from './jobs.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  @Get()
  async list() {
    return { jobs: await this.jobs.list() };
  }

  @Post()
  async create(@Body() dto: CreateJobDto) {
    const job = await this.jobs.create(dto);
    return { jobId: job.id };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.jobs.get(id);
  }

  @Post(':id/run')
  async run(@Param('id') id: string) {
    return this.jobs.run(id);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: ApproveJobDto) {
    return await this.jobs.approve(id, dto.stage, dto.comment);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: RejectJobDto) {
    return await this.jobs.reject(id, dto.stage, dto.reason, dto.comment);
  }

  @Get(':id/chat/sse')
  async chatSse(
    @Param('id') id: string,
    @Query('message') message: string,
    @Res() res: Response,
  ) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const abortController = new AbortController();
    let clientClosed = false;
    res.on('close', () => {
      clientClosed = true;
      abortController.abort();
    });

    const sendEvent = (event: string, data: unknown) => {
      if (clientClosed || res.writableEnded) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      if (!message || String(message).trim().length === 0) {
        sendEvent('error', { message: 'message is required' });
        res.end();
        return;
      }

      // 持久化用户消息
      const userMessage = await this.jobs.chatMessages.create(
        id,
        'user',
        message,
      );
      sendEvent('message', {
        id: userMessage.id,
        role: 'user',
        content: message,
      });

      // 检查是否为工作流指令
      const commandResult = this.workflowEngine.parseCommand(message);
      const naturalResult = this.workflowEngine.parseNaturalLanguage(message);

      if (commandResult || naturalResult) {
        const parsedCommand = commandResult || naturalResult;

        if (!parsedCommand) {
          sendEvent('error', { message: 'Failed to parse command' });
          res.end();
          return;
        }

        try {
          // 发送指令执行状态
          sendEvent('workflow_command', {
            type: 'executing',
            command: parsedCommand.command,
            params: parsedCommand.params,
          });

          // 执行指令
          const result = await this.workflowEngine.executeCommand({
            jobId: id,
            command: parsedCommand.command,
            params: parsedCommand.params,
          });

          // 发送执行结果
          sendEvent('workflow_command', {
            type: 'completed',
            command: parsedCommand.command,
            params: parsedCommand.params,
            result: result,
          });

          // 持久化助手回复
          const assistantMessage = await this.jobs.chatMessages.create(
            id,
            'assistant',
            result.message,
            { type: 'workflow_command', command: parsedCommand.command },
          );
          sendEvent('message', {
            id: assistantMessage.id,
            role: 'assistant',
            content: result.message,
          });

          res.end();
          return;
        } catch (error) {
          // 发送执行失败状态
          sendEvent('workflow_command', {
            type: 'failed',
            command: parsedCommand.command,
            params: parsedCommand.params,
            error: error instanceof Error ? error.message : String(error),
          });

          // 持久化错误回复
          const errorMessage = await this.jobs.chatMessages.create(
            id,
            'assistant',
            `指令执行失败: ${error instanceof Error ? error.message : String(error)}`,
            { type: 'workflow_command_error', command: parsedCommand.command },
          );
          sendEvent('message', {
            id: errorMessage.id,
            role: 'assistant',
            content: errorMessage.content,
          });

          res.end();
          return;
        }
      }

      const job = await this.jobs.get(id);
      const config = (job.config as { content?: string } | null) ?? null;
      const markdown = config?.content ?? '';

      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        sendEvent('error', { message: 'Missing OPENROUTER_API_KEY' });
        res.end();
        return;
      }

      const openai = createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });

      const model = openai('z-ai/glm-4.6');

      const result = streamText({
        model,
        temperature: 0.2,
        abortSignal: abortController.signal,
        messages: [
          {
            role: 'system',
            content:
              '你是 Rematrix 的助手。你需要根据 Job 的上下文回答用户问题。输出简洁、可操作。',
          },
          {
            role: 'user',
            content: `JobId: ${id}\nCurrentStage: ${job.currentStage}\n\nMarkdown:\n${markdown}\n\nUserMessage:\n${message}`,
          },
        ],
      });

      let assistantContent = '';
      for await (const delta of result.textStream) {
        if (clientClosed || res.writableEnded) break;
        assistantContent += delta;
        sendEvent('message', { role: 'assistant', delta });
      }

      // 持久化助手完整回复
      if (assistantContent && !clientClosed && !res.writableEnded) {
        const assistantMessage = await this.jobs.chatMessages.create(
          id,
          'assistant',
          assistantContent,
        );
        // 可选：发送完整消息事件（包含 id）
        sendEvent('message', {
          id: assistantMessage.id,
          role: 'assistant',
          content: assistantContent,
          done: true,
        });
      }

      // 如果 Job 状态为 WAITING_APPROVAL，推送 approval_request
      if (
        job.status === 'WAITING_APPROVAL' &&
        !clientClosed &&
        !res.writableEnded
      ) {
        const approvalMessage = await this.jobs.chatMessages.create(
          id,
          'assistant',
          `请确认当前阶段 ${job.currentStage} 的物料是否满足要求？`,
          { type: 'approval_request', stage: job.currentStage },
        );
        sendEvent('approval_request', {
          messageId: approvalMessage.id,
          stage: job.currentStage,
          artifactSummary: `当前阶段 ${job.currentStage} 的物料已生成，请确认是否继续。`,
          actions: [
            { key: 'approve', label: '确认' },
            { key: 'reject', label: '拒绝' },
          ],
        });
      }

      if (!clientClosed && !res.writableEnded) {
        sendEvent('done', { ok: true });
        res.end();
      }
    } catch (err: unknown) {
      if (clientClosed || res.writableEnded) return;
      const message = err instanceof Error ? err.message : String(err);
      sendEvent('error', { message });
      res.end();
    }
  }
}
