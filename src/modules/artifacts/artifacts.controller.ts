import { Controller, Get, Param, Query } from '@nestjs/common';
import { ArtifactsService } from './artifacts.service';

@Controller('jobs/:jobId/artifacts')
export class ArtifactsController {
  constructor(private readonly artifacts: ArtifactsService) {}

  @Get()
  async list(
    @Param('jobId') jobId: string,
    @Query('waitForStage') waitForStage?: string,
    @Query('timeoutMs') timeoutMs?: string,
  ) {
    const parsedTimeoutMs = timeoutMs ? Number(timeoutMs) : undefined;
    return this.artifacts.listByJob({
      jobId,
      waitForStage,
      timeoutMs: Number.isFinite(parsedTimeoutMs) ? parsedTimeoutMs : undefined,
    });
  }
}
