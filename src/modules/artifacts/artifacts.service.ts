import { BadRequestException, Injectable } from '@nestjs/common';
import { Artifact, JobStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ArtifactsService {
  constructor(private readonly prisma: PrismaService) {}

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async listByJob(params: {
    jobId: string;
    waitForStage?: string;
    timeoutMs?: number;
  }): Promise<{ artifacts: Artifact[]; timeout: boolean }> {
    const timeoutMs = params.timeoutMs ?? 10_000;
    const intervalMs = 200;

    if (params.waitForStage) {
      const allowedStages = Object.values(JobStage) as string[];
      if (!allowedStages.includes(params.waitForStage)) {
        throw new BadRequestException('invalid waitForStage');
      }

      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const found = await this.prisma.artifact.findFirst({
          where: {
            jobId: params.jobId,
            stage: params.waitForStage as JobStage,
          },
          select: { id: true },
        });

        if (found) break;
        await this.sleep(intervalMs);
      }
    }

    const artifacts = await this.prisma.artifact.findMany({
      where: { jobId: params.jobId },
      orderBy: [{ stage: 'asc' }, { type: 'asc' }, { version: 'desc' }],
    });

    const timeout = params.waitForStage
      ? !artifacts.some((a) => a.stage === params.waitForStage)
      : false;

    return { artifacts, timeout };
  }
}
