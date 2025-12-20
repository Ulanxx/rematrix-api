import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, JobStage, JobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TemporalClientService } from '../temporal/temporal-client.service';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly temporal: TemporalClientService,
  ) {}

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async create(dto: CreateJobDto) {
    if (!dto.markdown) {
      throw new BadRequestException('markdown is required');
    }

    const job = await this.prisma.job.create({
      data: {
        status: JobStatus.DRAFT,
        currentStage: JobStage.PLAN,
        config: {
          markdown: dto.markdown,
          targetDurationSec: dto.targetDurationSec,
          style: dto.style,
          language: dto.language,
        },
      },
    });

    return job;
  }

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

  async get(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('job not found');
    return job;
  }

  async run(jobId: string) {
    const job = await this.get(jobId);
    const config = job.config as { markdown?: string } | null;
    const markdown = config?.markdown;
    if (!markdown) {
      throw new BadRequestException('job.config.markdown is missing');
    }

    return this.temporal.startVideoGeneration({ jobId, markdown });
  }

  async approve(jobId: string, stage: string) {
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
        job?.currentStage !== (stage as JobStage)
      ) {
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

  async reject(jobId: string, stage: string, reason?: string) {
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
}
