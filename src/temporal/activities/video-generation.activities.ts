import {
  ApprovalStatus,
  ArtifactType,
  JobStage,
  JobStatus,
  PrismaClient,
} from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { uploadJsonToBunny } from '../../utils/bunny-storage';

function errorToString(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DATABASE_URL');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

export type VideoGenerationInput = {
  jobId: string;
  markdown: string;
};

export async function ensureJob(jobId: string) {
  await prisma.job.upsert({
    where: { id: jobId },
    update: {},
    create: {
      id: jobId,
      status: JobStatus.DRAFT,
      currentStage: JobStage.PLAN,
    },
  });
}

export async function runPlanStage(input: VideoGenerationInput) {
  await ensureJob(input.jobId);

  const plan = {
    estimatedPages: 6,
    estimatedDurationSec: 60,
    style: 'default',
    questions: ['是否需要更偏技术讲解还是偏科普风格？'],
  };

  await prisma.artifact.create({
    data: {
      jobId: input.jobId,
      stage: JobStage.PLAN,
      type: ArtifactType.JSON,
      version: 1,
      content: plan,
      createdBy: 'system',
    },
  });

  await prisma.approval.upsert({
    where: { jobId_stage: { jobId: input.jobId, stage: JobStage.PLAN } },
    update: { status: ApprovalStatus.PENDING, comment: null },
    create: {
      jobId: input.jobId,
      stage: JobStage.PLAN,
      status: ApprovalStatus.PENDING,
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      status: JobStatus.WAITING_APPROVAL,
      currentStage: JobStage.PLAN,
    },
  });

  return plan;
}

export async function runOutlineStage(input: VideoGenerationInput) {
  await ensureJob(input.jobId);

  const latest = await prisma.artifact.findFirst({
    where: { jobId: input.jobId, stage: JobStage.OUTLINE },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const outline = {
    title: 'Auto Outline',
    sections: [
      {
        title: 'Intro',
        bullets: ['引入主题', '明确目标'],
      },
      {
        title: 'Main',
        bullets: ['关键点 1', '关键点 2', '关键点 3'],
      },
      {
        title: 'Outro',
        bullets: ['总结', '下一步'],
      },
    ],
    source: {
      markdownPreview: input.markdown.slice(0, 200),
    },
  };

  let blobUrl: string | null = null;
  try {
    const path = `jobs/${input.jobId}/artifacts/OUTLINE/v${nextVersion}.json`;
    const uploaded = await uploadJsonToBunny({ path, json: outline });
    blobUrl = uploaded.publicUrl ?? uploaded.storageUrl;
  } catch (err: unknown) {
    console.error('[bunny] upload outline failed', errorToString(err));
    blobUrl = null;
  }

  await prisma.artifact.create({
    data: {
      jobId: input.jobId,
      stage: JobStage.OUTLINE,
      type: ArtifactType.JSON,
      version: nextVersion,
      content: outline,
      blobUrl,
      createdBy: 'system',
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      currentStage: JobStage.OUTLINE,
      status: JobStatus.RUNNING,
    },
  });

  return outline;
}

export async function markStageApproved(jobId: string, stage: JobStage) {
  try {
    await prisma.approval.upsert({
      where: { jobId_stage: { jobId, stage } },
      update: { status: ApprovalStatus.APPROVED },
      create: {
        jobId,
        stage,
        status: ApprovalStatus.APPROVED,
      },
    });

    await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.RUNNING },
    });
  } catch (err: unknown) {
    console.error('[activity] markStageApproved failed', {
      jobId,
      stage,
      error: errorToString(err),
    });
    throw err;
  }
}

export async function markStageRejected(
  jobId: string,
  stage: JobStage,
  reason?: string,
) {
  try {
    await prisma.approval.upsert({
      where: { jobId_stage: { jobId, stage } },
      update: { status: ApprovalStatus.REJECTED, comment: reason ?? null },
      create: {
        jobId,
        stage,
        status: ApprovalStatus.REJECTED,
        comment: reason ?? null,
      },
    });

    await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.WAITING_APPROVAL },
    });
  } catch (err: unknown) {
    console.error('[activity] markStageRejected failed', {
      jobId,
      stage,
      reason,
      error: errorToString(err),
    });
    throw err;
  }
}

export async function advanceAfterPlan(jobId: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      currentStage: JobStage.OUTLINE,
    },
  });
}
