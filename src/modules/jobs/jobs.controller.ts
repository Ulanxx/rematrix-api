import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import type { Response } from 'express';
import { CreateJobDto } from './dto/create-job.dto';
import { ApproveJobDto } from './dto/approve-job.dto';
import { RejectJobDto } from './dto/reject-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

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
    const stage = dto.stage ?? 'PLAN';
    return this.jobs.approve(id, stage);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: RejectJobDto) {
    const stage = dto.stage ?? 'PLAN';
    return await this.jobs.reject(id, stage, dto.reason);
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

      const job = await this.jobs.get(id);
      const config = (job.config as { markdown?: string } | null) ?? null;
      const markdown = config?.markdown ?? '';

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

      const model = openai('z-ai/glm-4.6v');

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

      for await (const delta of result.textStream) {
        if (clientClosed || res.writableEnded) break;
        sendEvent('message', { role: 'assistant', delta });
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
