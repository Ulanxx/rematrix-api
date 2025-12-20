import {
  ApprovalStatus,
  ArtifactType,
  JobStage,
  JobStatus,
  PrismaClient,
} from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import ffmpegImport from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import {
  uploadBufferToBunny,
  uploadJsonToBunny,
} from '../../utils/bunny-storage';
import {
  getOutputContract,
  getQualityLoopConfig,
  sha256,
} from '../../utils/promptops-utils';

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

async function loadPromptConfigById(id: string) {
  return await prisma.promptStageConfig.findUnique({
    where: { id },
    select: {
      id: true,
      model: true,
      temperature: true,
      prompt: true,
      tools: true,
      schema: true,
      meta: true,
    },
  });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Missing DATABASE_URL');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

type PromptStageConfigLike = {
  configId: string | null;
  model: string;
  temperature: number | null;
  prompt: string;
  tools?: unknown;
  schema?: unknown;
  meta?: unknown;
};

async function generateWithOptionalQualityLoop<T>(params: {
  stage: JobStage;
  apiKey: string;
  cfg: PromptStageConfigLike;
  schema: z.ZodType<T>;
  prompt: string;
}) {
  const outputContract = getOutputContract(params.cfg.meta);
  const qualityLoop = getQualityLoopConfig(params.cfg.meta);

  const maxAttempts = Math.max(0, qualityLoop?.maxAttempts ?? 0);
  const enable = Boolean(qualityLoop?.enable);

  // attempt 0: initial generation
  const { object: initial } = await generateObject({
    model: getOpenRouterModel({
      apiKey: params.apiKey,
      model: params.cfg.model,
    }),
    temperature: params.cfg.temperature ?? undefined,
    schema: params.schema,
    prompt: params.prompt,
  });

  if (
    !enable ||
    !qualityLoop?.checkPromptId ||
    !qualityLoop?.repairPromptId ||
    maxAttempts <= 0
  ) {
    return {
      object: initial,
      repairAttempt: 0,
      qualityStatus: 'generated' as const,
      schemaVersion: outputContract?.schemaVersion ?? null,
    };
  }

  // quality loop is enabled: run QA->Repair for up to maxAttempts
  let current: unknown = initial;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const checkCfg = await loadPromptConfigById(qualityLoop.checkPromptId);
    const repairCfg = await loadPromptConfigById(qualityLoop.repairPromptId);
    if (!checkCfg || !repairCfg) {
      return {
        object: initial,
        repairAttempt: 0,
        qualityStatus: 'generated' as const,
        schemaVersion: outputContract?.schemaVersion ?? null,
      };
    }

    const qaSchema = z.object({
      status: z.enum(['PASS', 'FAIL']),
      summary: z.string().optional(),
      issues: z
        .array(
          z.object({
            type: z.string(),
            description: z.string(),
          }),
        )
        .optional(),
      action_plan: z
        .object({
          specific_instructions: z.array(z.string()).default([]),
        })
        .optional(),
    });

    const { object: qa } = await generateObject({
      model: getOpenRouterModel({
        apiKey: params.apiKey,
        model: checkCfg.model,
      }),
      temperature: checkCfg.temperature ?? undefined,
      schema: qaSchema,
      prompt: `${checkCfg.prompt}\n\n<stage>${params.stage}</stage>\n<original_json>${JSON.stringify(current, null, 2)}</original_json>`,
    });

    if (qa.status === 'PASS') {
      return {
        object: current as T,
        repairAttempt: attempt - 1,
        qualityStatus: 'passed' as const,
        schemaVersion: outputContract?.schemaVersion ?? null,
      };
    }

    const { object: repaired } = await generateObject({
      model: getOpenRouterModel({
        apiKey: params.apiKey,
        model: repairCfg.model,
      }),
      temperature: repairCfg.temperature ?? undefined,
      schema: params.schema,
      prompt: `${repairCfg.prompt}\n\n<stage>${params.stage}</stage>\n<qa_report>${JSON.stringify(qa, null, 2)}</qa_report>\n<original_json>${JSON.stringify(current, null, 2)}</original_json>`,
    });

    current = repaired;
  }

  return {
    object: current as T,
    repairAttempt: maxAttempts,
    qualityStatus: 'repaired' as const,
    schemaVersion: outputContract?.schemaVersion ?? null,
  };
}

type PromptStageActiveLike = {
  activeConfigId?: string;
  activeConfig?: {
    id?: string;
    model: string;
    temperature: number | null;
    prompt: string;
    tools?: unknown;
    schema?: unknown;
    meta?: unknown;
  } | null;
};

type PromptStageActiveDelegateLike = {
  findUnique: (args: {
    where: { stage: JobStage };
    include: { activeConfig: true };
  }) => Promise<PromptStageActiveLike | null>;
};

type PromptopsPrismaLike = {
  promptStageActive: PromptStageActiveDelegateLike;
};

type FfmpegCmdLike = {
  input: (source: string) => FfmpegCmdLike;
  inputFormat: (format: string) => FfmpegCmdLike;
  outputOptions: (options: string[]) => FfmpegCmdLike;
  on: (event: string, cb: (...args: unknown[]) => void) => FfmpegCmdLike;
  save: (outputPath: string) => FfmpegCmdLike;
};

const STAGE_ORDER: Record<JobStage, number> = {
  PLAN: 1,
  OUTLINE: 2,
  STORYBOARD: 3,
  NARRATION: 4,
  PAGES: 5,
  TTS: 6,
  RENDER: 7,
  MERGE: 8,
  DONE: 9,
};

function isStageAtOrAfter(current: JobStage, target: JobStage): boolean {
  return (STAGE_ORDER[current] ?? 0) >= (STAGE_ORDER[target] ?? 0);
}

function getOpenRouterModel(params: { apiKey: string; model: string }) {
  const openai = createOpenAI({
    apiKey: params.apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
  return openai(params.model);
}

async function getPromptConfig(
  stage: JobStage,
): Promise<PromptStageConfigLike> {
  const defaults: Record<JobStage, PromptStageConfigLike> = {
    PLAN: {
      configId: null,
      model: 'z-ai/glm-4.6v',
      temperature: null,
      prompt:
        '你是视频生成的策划助手。根据用户给定的 Markdown，生成一个视频计划（PLAN），必须严格输出为 JSON，字段符合 schema。',
    },
    OUTLINE: {
      configId: null,
      model: 'z-ai/glm-4.6v',
      temperature: null,
      prompt:
        '你是视频生成的大纲助手。根据 Markdown 和 PLAN(JSON)，生成一个 OUTLINE(JSON)，必须严格输出为 JSON，字段符合 schema。',
    },
    STORYBOARD: {
      configId: null,
      model: 'z-ai/glm-4.6v',
      temperature: null,
      prompt:
        '你是视频生成的分镜助手。根据 OUTLINE(JSON)，生成 STORYBOARD(JSON)，必须严格输出为 JSON，字段符合 schema。',
    },
    NARRATION: {
      configId: null,
      model: 'z-ai/glm-4.6v',
      temperature: null,
      prompt:
        '你是视频生成的旁白撰写助手。根据 STORYBOARD(JSON)，生成 NARRATION(JSON)，必须严格输出为 JSON，字段符合 schema。',
    },
    PAGES: {
      configId: null,
      model: 'z-ai/glm-4.6v',
      temperature: null,
      prompt:
        '你是视频生成的页面脚本助手。根据 STORYBOARD(JSON) 与 NARRATION(JSON)，生成 PAGES(JSON)，必须严格输出为 JSON，字段符合 schema。',
    },
    TTS: {
      configId: null,
      model: 'z-ai/glm-4.6v',
      temperature: null,
      prompt: 'TTS 阶段不调用 LLM（当前 MVP 为静音音频）。',
    },
    RENDER: {
      configId: null,
      model: 'z-ai/glm-4.6v',
      temperature: 0,
      prompt: 'RENDER 阶段不调用 LLM。',
    },
    MERGE: {
      configId: null,
      model: 'z-ai/glm-4.6v',
      temperature: 0,
      prompt: 'MERGE 阶段不调用 LLM。',
    },
    DONE: {
      configId: null,
      model: 'z-ai/glm-4.6v',
      temperature: 0,
      prompt: 'DONE。',
    },
  };

  try {
    const promptopsPrisma = prisma as unknown as PromptopsPrismaLike;
    const active = await promptopsPrisma.promptStageActive.findUnique({
      where: { stage },
      include: { activeConfig: true },
    });
    if (active?.activeConfig) {
      return {
        configId:
          active.activeConfigId ?? (active.activeConfig.id as string) ?? null,
        model: active.activeConfig.model,
        temperature: active.activeConfig.temperature,
        prompt: active.activeConfig.prompt,
        tools: active.activeConfig.tools,
        schema: active.activeConfig.schema,
        meta: active.activeConfig.meta,
      };
    }
  } catch (err: unknown) {
    console.error('[promptops] load active config failed', {
      stage,
      error: errorToString(err),
    });
  }

  return defaults[stage];
}

async function readLatestJsonArtifact(params: {
  jobId: string;
  stage: JobStage;
}) {
  return await prisma.artifact.findFirst({
    where: {
      jobId: params.jobId,
      stage: params.stage,
      type: ArtifactType.JSON,
    },
    orderBy: { version: 'desc' },
    select: { version: true, content: true },
  });
}

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

  const existingPlan = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.PLAN,
  });
  const existingApproval = await prisma.approval.findUnique({
    where: { jobId_stage: { jobId: input.jobId, stage: JobStage.PLAN } },
    select: { status: true },
  });
  if (existingPlan?.content && existingApproval) {
    return existingPlan.content;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');

  const cfg = await getPromptConfig(JobStage.PLAN);
  const planSchema = z.object({
    estimatedPages: z.number().int().min(1).max(40),
    estimatedDurationSec: z.number().int().min(10).max(600),
    style: z.string().min(1),
    questions: z.array(z.string()).default([]),
  });

  const generated = await generateWithOptionalQualityLoop({
    stage: JobStage.PLAN,
    apiKey,
    cfg,
    schema: planSchema,
    prompt: `${cfg.prompt}\n\n# Markdown\n${input.markdown}`,
  });
  const plan = generated.object;

  const inputsHash = sha256(
    JSON.stringify({ stage: JobStage.PLAN, markdown: input.markdown }),
  );

  await prisma.artifact.create({
    data: {
      jobId: input.jobId,
      stage: JobStage.PLAN,
      type: ArtifactType.JSON,
      version: 1,
      content: plan,
      meta: {
        inputsHash,
        promptConfigId: cfg.configId,
        model: cfg.model,
        temperature: cfg.temperature,
        tools: cfg.tools ?? null,
        schemaVersion: generated.schemaVersion,
        repairAttempt: generated.repairAttempt,
        qualityStatus: generated.qualityStatus,
      },
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

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: { currentStage: true },
  });
  const existing = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.OUTLINE,
  });
  if (existing?.content && job?.currentStage) {
    if (isStageAtOrAfter(job.currentStage, JobStage.OUTLINE)) {
      return existing.content;
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');

  const planArtifact = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.PLAN,
  });

  const cfg = await getPromptConfig(JobStage.OUTLINE);
  const outlineSchema = z.object({
    title: z.string().min(1),
    sections: z.array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(1),
      }),
    ),
  });

  const latest = await prisma.artifact.findFirst({
    where: { jobId: input.jobId, stage: JobStage.OUTLINE },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const generated = await generateWithOptionalQualityLoop({
    stage: JobStage.OUTLINE,
    apiKey,
    cfg,
    schema: outlineSchema,
    prompt: `${cfg.prompt}\n\n# Markdown\n${input.markdown}\n\n# PLAN(JSON)\n${JSON.stringify(planArtifact?.content ?? {}, null, 2)}`,
  });
  const outline = generated.object;

  const inputsHash = sha256(
    JSON.stringify({
      stage: JobStage.OUTLINE,
      markdown: input.markdown,
      plan: planArtifact?.content ?? {},
    }),
  );

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
      meta: {
        inputsHash,
        promptConfigId: cfg.configId,
        model: cfg.model,
        temperature: cfg.temperature,
        tools: cfg.tools ?? null,
        schemaVersion: generated.schemaVersion,
        repairAttempt: generated.repairAttempt,
        qualityStatus: generated.qualityStatus,
      },
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

export async function runStoryboardStage(input: VideoGenerationInput) {
  await ensureJob(input.jobId);

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: { currentStage: true },
  });
  const existing = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.STORYBOARD,
  });
  if (existing?.content && job?.currentStage) {
    if (isStageAtOrAfter(job.currentStage, JobStage.STORYBOARD)) {
      return existing.content;
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');

  const outlineArtifact = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.OUTLINE,
  });

  const latest = await prisma.artifact.findFirst({
    where: { jobId: input.jobId, stage: JobStage.STORYBOARD },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const cfg = await getPromptConfig(JobStage.STORYBOARD);
  const storyboardSchema = z.object({
    pages: z.array(
      z.object({
        page: z.number().int().min(1),
        visual: z.array(z.string().min(1)).min(1),
        narrationHints: z.array(z.string().min(1)).min(1),
      }),
    ),
  });

  const generated = await generateWithOptionalQualityLoop({
    stage: JobStage.STORYBOARD,
    apiKey,
    cfg,
    schema: storyboardSchema,
    prompt: `${cfg.prompt}\n\n# OUTLINE(JSON)\n${JSON.stringify(outlineArtifact?.content ?? {}, null, 2)}`,
  });
  const storyboard = generated.object;

  const inputsHash = sha256(
    JSON.stringify({
      stage: JobStage.STORYBOARD,
      outline: outlineArtifact?.content ?? {},
    }),
  );

  let blobUrl: string | null = null;
  try {
    const uploadPath = `jobs/${input.jobId}/artifacts/STORYBOARD/v${nextVersion}.json`;
    const uploaded = await uploadJsonToBunny({
      path: uploadPath,
      json: storyboard,
    });
    blobUrl = uploaded.publicUrl ?? uploaded.storageUrl;
  } catch (err: unknown) {
    console.error('[bunny] upload storyboard failed', errorToString(err));
    blobUrl = null;
  }

  await prisma.artifact.create({
    data: {
      jobId: input.jobId,
      stage: JobStage.STORYBOARD,
      type: ArtifactType.JSON,
      version: nextVersion,
      content: storyboard,
      blobUrl,
      meta: {
        inputsHash,
        promptConfigId: cfg.configId,
        model: cfg.model,
        temperature: cfg.temperature,
        tools: cfg.tools ?? null,
        schemaVersion: generated.schemaVersion,
        repairAttempt: generated.repairAttempt,
        qualityStatus: generated.qualityStatus,
      },
      createdBy: 'system',
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      currentStage: JobStage.STORYBOARD,
      status: JobStatus.RUNNING,
    },
  });

  return storyboard;
}

export async function runNarrationStage(input: VideoGenerationInput) {
  await ensureJob(input.jobId);

  const existingNarration = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.NARRATION,
  });
  const existingApproval = await prisma.approval.findUnique({
    where: { jobId_stage: { jobId: input.jobId, stage: JobStage.NARRATION } },
    select: { status: true },
  });
  if (existingNarration?.content && existingApproval) {
    return existingNarration.content;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');

  const storyboardArtifact = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.STORYBOARD,
  });

  const cfg = await getPromptConfig(JobStage.NARRATION);
  const narrationSchema = z.object({
    pages: z.array(
      z.object({
        page: z.number().int().min(1),
        text: z.string().min(1),
      }),
    ),
  });

  const latest = await prisma.artifact.findFirst({
    where: { jobId: input.jobId, stage: JobStage.NARRATION },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const generated = await generateWithOptionalQualityLoop({
    stage: JobStage.NARRATION,
    apiKey,
    cfg,
    schema: narrationSchema,
    prompt: `${cfg.prompt}\n\n# STORYBOARD(JSON)\n${JSON.stringify(storyboardArtifact?.content ?? {}, null, 2)}\n\n# Markdown\n${input.markdown}`,
  });
  const narration = generated.object;

  const inputsHash = sha256(
    JSON.stringify({
      stage: JobStage.NARRATION,
      markdown: input.markdown,
      storyboard: storyboardArtifact?.content ?? {},
    }),
  );

  let blobUrl: string | null = null;
  try {
    const path = `jobs/${input.jobId}/artifacts/NARRATION/v${nextVersion}.json`;
    const uploaded = await uploadJsonToBunny({ path, json: narration });
    blobUrl = uploaded.publicUrl ?? uploaded.storageUrl;
  } catch (err: unknown) {
    console.error('[bunny] upload narration failed', errorToString(err));
    blobUrl = null;
  }

  await prisma.artifact.create({
    data: {
      jobId: input.jobId,
      stage: JobStage.NARRATION,
      type: ArtifactType.JSON,
      version: nextVersion,
      content: narration,
      blobUrl,
      meta: {
        inputsHash,
        promptConfigId: cfg.configId,
        model: cfg.model,
        temperature: cfg.temperature,
        tools: cfg.tools ?? null,
        schemaVersion: generated.schemaVersion,
        repairAttempt: generated.repairAttempt,
        qualityStatus: generated.qualityStatus,
      },
      createdBy: 'system',
    },
  });

  await prisma.approval.upsert({
    where: {
      jobId_stage: {
        jobId: input.jobId,
        stage: JobStage.NARRATION,
      },
    },
    update: { status: ApprovalStatus.PENDING, comment: null },
    create: {
      jobId: input.jobId,
      stage: JobStage.NARRATION,
      status: ApprovalStatus.PENDING,
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      currentStage: JobStage.NARRATION,
      status: JobStatus.WAITING_APPROVAL,
    },
  });

  return narration;
}

export async function runPagesStage(input: VideoGenerationInput) {
  await ensureJob(input.jobId);

  const existingPages = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.PAGES,
  });
  const existingApproval = await prisma.approval.findUnique({
    where: { jobId_stage: { jobId: input.jobId, stage: JobStage.PAGES } },
    select: { status: true },
  });
  if (existingPages?.content && existingApproval) {
    return existingPages.content;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY');

  const storyboardArtifact = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.STORYBOARD,
  });
  const narrationArtifact = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.NARRATION,
  });

  const cfg = await getPromptConfig(JobStage.PAGES);
  const pagesSchema = z.object({
    theme: z.object({
      primary: z.string().min(1),
      background: z.string().min(1),
      text: z.string().min(1),
    }),
    slides: z.array(
      z.object({
        title: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(1),
      }),
    ),
  });

  const latest = await prisma.artifact.findFirst({
    where: { jobId: input.jobId, stage: JobStage.PAGES },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const generated = await generateWithOptionalQualityLoop({
    stage: JobStage.PAGES,
    apiKey,
    cfg,
    schema: pagesSchema,
    prompt: `${cfg.prompt}\n\n# STORYBOARD(JSON)\n${JSON.stringify(storyboardArtifact?.content ?? {}, null, 2)}\n\n# NARRATION(JSON)\n${JSON.stringify(narrationArtifact?.content ?? {}, null, 2)}`,
  });
  const pages = generated.object;

  const inputsHash = sha256(
    JSON.stringify({
      stage: JobStage.PAGES,
      storyboard: storyboardArtifact?.content ?? {},
      narration: narrationArtifact?.content ?? {},
    }),
  );

  let blobUrl: string | null = null;
  try {
    const path = `jobs/${input.jobId}/artifacts/PAGES/v${nextVersion}.json`;
    const uploaded = await uploadJsonToBunny({ path, json: pages });
    blobUrl = uploaded.publicUrl ?? uploaded.storageUrl;
  } catch (err: unknown) {
    console.error('[bunny] upload pages failed', errorToString(err));
    blobUrl = null;
  }

  await prisma.artifact.create({
    data: {
      jobId: input.jobId,
      stage: JobStage.PAGES,
      type: ArtifactType.JSON,
      version: nextVersion,
      content: pages,
      blobUrl,
      meta: {
        inputsHash,
        promptConfigId: cfg.configId,
        model: cfg.model,
        temperature: cfg.temperature,
        tools: cfg.tools ?? null,
        schemaVersion: generated.schemaVersion,
        repairAttempt: generated.repairAttempt,
        qualityStatus: generated.qualityStatus,
      },
      createdBy: 'system',
    },
  });

  await prisma.approval.upsert({
    where: {
      jobId_stage: {
        jobId: input.jobId,
        stage: JobStage.PAGES,
      },
    },
    update: { status: ApprovalStatus.PENDING, comment: null },
    create: {
      jobId: input.jobId,
      stage: JobStage.PAGES,
      status: ApprovalStatus.PENDING,
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      currentStage: JobStage.PAGES,
      status: JobStatus.WAITING_APPROVAL,
    },
  });

  return pages;
}

export async function runTtsStage(input: VideoGenerationInput) {
  await ensureJob(input.jobId);

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: { currentStage: true },
  });
  const existing = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.TTS,
      type: ArtifactType.AUDIO,
    },
    orderBy: { version: 'desc' },
    select: { content: true },
  });
  if (existing?.content && job?.currentStage) {
    if (isStageAtOrAfter(job.currentStage, JobStage.TTS)) {
      return existing.content;
    }
  }

  const narrationArtifact = await readLatestJsonArtifact({
    jobId: input.jobId,
    stage: JobStage.NARRATION,
  });

  const latest = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.TTS,
      type: ArtifactType.AUDIO,
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `rematrix-${input.jobId}-tts-`),
  );
  const outPath = path.join(tmpDir, 'tts.mp3');

  // MVP: 生成一段静音音频，保证后续 pipeline 可运行。
  // 后续可替换为 listenhub provider。
  ffmpegImport.setFfmpegPath(ffmpegInstaller.path);

  const durationSec = 5;
  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpegImport() as unknown as FfmpegCmdLike;
    cmd
      .input('anullsrc=r=44100:cl=stereo')
      .inputFormat('lavfi')
      .outputOptions([
        '-t',
        String(durationSec),
        '-q:a',
        '9',
        '-acodec',
        'libmp3lame',
      ])
      .on('end', () => resolve())
      .on('error', (err: unknown) =>
        reject(err instanceof Error ? err : new Error(String(err))),
      )
      .save(outPath);
  });

  let blobUrl: string | null = null;
  try {
    const data = await fs.readFile(outPath);
    const uploadPath = `jobs/${input.jobId}/artifacts/TTS/v${nextVersion}.mp3`;
    const uploaded = await uploadBufferToBunny({
      path: uploadPath,
      contentType: 'audio/mpeg',
      data: new Uint8Array(data),
    });
    blobUrl = uploaded.publicUrl ?? uploaded.storageUrl;
  } catch (err: unknown) {
    console.error('[bunny] upload tts audio failed', errorToString(err));
    blobUrl = null;
  }

  const ttsMeta = {
    format: 'mp3',
    durationSec,
    sourceNarrationVersion: narrationArtifact?.version ?? null,
  };

  const inputsHash = sha256(
    JSON.stringify({
      stage: JobStage.TTS,
      narrationVersion: narrationArtifact?.version ?? null,
      narration: narrationArtifact?.content ?? {},
    }),
  );

  await prisma.artifact.create({
    data: {
      jobId: input.jobId,
      stage: JobStage.TTS,
      type: ArtifactType.AUDIO,
      version: nextVersion,
      content: ttsMeta,
      blobUrl,
      meta: {
        inputsHash,
        sourceNarrationVersion: narrationArtifact?.version ?? null,
      },
      createdBy: 'system',
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      currentStage: JobStage.TTS,
      status: JobStatus.RUNNING,
    },
  });

  return ttsMeta;
}

function renderSlideHtml(params: {
  title: string;
  bullets: string[];
  theme?: { primary?: string; background?: string; text?: string };
}) {
  const primary = params.theme?.primary ?? '#4285F4';
  const background = params.theme?.background ?? '#F8F9FA';
  const text = params.theme?.text ?? '#202124';

  const bullets = params.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        background: ${background};
        color: ${text};
      }
      .frame {
        width: 1280px;
        height: 720px;
        padding: 64px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .kicker {
        color: ${primary};
        font-weight: 600;
        letter-spacing: .08em;
        text-transform: uppercase;
        font-size: 14px;
      }
      h1 {
        margin: 14px 0 18px;
        font-size: 54px;
        line-height: 1.08;
      }
      ul {
        margin: 0;
        padding-left: 26px;
        font-size: 28px;
        line-height: 1.55;
      }
      li { margin: 8px 0; }
      .footer {
        position: absolute;
        left: 64px;
        bottom: 32px;
        font-size: 14px;
        opacity: 0.6;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="kicker">Rematrix</div>
      <h1>${escapeHtml(params.title)}</h1>
      <ul>${bullets}</ul>
      <div class="footer">Generated by Temporal</div>
    </div>
  </body>
</html>`;
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function runRenderStage(input: VideoGenerationInput) {
  await ensureJob(input.jobId);

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: { currentStage: true },
  });
  const existing = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.RENDER,
      type: ArtifactType.JSON,
    },
    orderBy: { version: 'desc' },
    select: { content: true },
  });
  if (existing?.content && job?.currentStage) {
    if (isStageAtOrAfter(job.currentStage, JobStage.RENDER)) {
      return existing.content;
    }
  }

  const pagesArtifact = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.PAGES,
      type: ArtifactType.JSON,
    },
    orderBy: { version: 'desc' },
    select: { content: true, version: true },
  });

  const pages = (pagesArtifact?.content ?? {}) as {
    theme?: { primary?: string; background?: string; text?: string };
    slides?: Array<{ title?: string; bullets?: string[] }>;
  };

  const slides = Array.isArray(pages.slides) ? pages.slides : [];

  const latest = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.RENDER,
      type: ArtifactType.JSON,
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `rematrix-${input.jobId}-render-`),
  );
  const framePaths: string[] = [];
  const uploadedFrames: Array<{ index: number; blobUrl: string | null }> = [];

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    for (let i = 0; i < Math.max(slides.length, 1); i++) {
      const slide = slides[i] ?? { title: '空白页', bullets: [] };
      const html = renderSlideHtml({
        title: String(slide.title ?? `Page ${i + 1}`),
        bullets: Array.isArray(slide.bullets) ? slide.bullets.map(String) : [],
        theme: pages.theme,
      });

      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const filename = `frame-${String(i + 1).padStart(3, '0')}.png`;
      const filePath = path.join(tmpDir, filename);
      await page.screenshot({ path: filePath, type: 'png' });
      framePaths.push(filePath);

      let blobUrl: string | null = null;
      try {
        const data = await fs.readFile(filePath);
        const uploadPath = `jobs/${input.jobId}/artifacts/RENDER/v${nextVersion}/${filename}`;
        const uploaded = await uploadBufferToBunny({
          path: uploadPath,
          contentType: 'image/png',
          data: new Uint8Array(data),
        });
        blobUrl = uploaded.publicUrl ?? uploaded.storageUrl;
      } catch (err: unknown) {
        console.error('[bunny] upload render frame failed', errorToString(err));
        blobUrl = null;
      }

      uploadedFrames.push({ index: i + 1, blobUrl });
    }
  } finally {
    await browser.close();
  }

  const renderResult = {
    sourcePagesVersion: pagesArtifact?.version ?? null,
    frameCount: uploadedFrames.length,
    frames: uploadedFrames,
  };

  const inputsHash = sha256(
    JSON.stringify({
      stage: JobStage.RENDER,
      sourcePagesVersion: pagesArtifact?.version ?? null,
      pages: pagesArtifact?.content ?? {},
    }),
  );

  await prisma.artifact.create({
    data: {
      jobId: input.jobId,
      stage: JobStage.RENDER,
      type: ArtifactType.JSON,
      version: nextVersion,
      content: renderResult,
      meta: {
        inputsHash,
        sourcePagesVersion: pagesArtifact?.version ?? null,
      },
      createdBy: 'system',
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      currentStage: JobStage.RENDER,
      status: JobStatus.RUNNING,
    },
  });

  return renderResult;
}

export async function runMergeStage(input: VideoGenerationInput) {
  await ensureJob(input.jobId);

  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: { currentStage: true },
  });
  const existing = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.MERGE,
      type: ArtifactType.VIDEO,
    },
    orderBy: { version: 'desc' },
    select: { content: true, blobUrl: true },
  });
  if (existing?.content && job?.currentStage) {
    if (isStageAtOrAfter(job.currentStage, JobStage.MERGE)) {
      const meta = existing.content as Record<string, unknown>;
      return { ...meta, blobUrl: existing.blobUrl ?? null };
    }
  }

  const renderArtifact = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.RENDER,
      type: ArtifactType.JSON,
    },
    orderBy: { version: 'desc' },
    select: { version: true, content: true },
  });

  const renderVersion = renderArtifact?.version ?? 1;
  const tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `rematrix-${input.jobId}-merge-`),
  );
  const outPath = path.join(tmpDir, 'output.mp4');

  const ttsArtifact = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.TTS,
      type: ArtifactType.AUDIO,
    },
    orderBy: { version: 'desc' },
    select: { blobUrl: true },
  });

  let audioPath: string | null = null;
  if (ttsArtifact?.blobUrl) {
    try {
      const res = await fetch(ttsArtifact.blobUrl);
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        const local = path.join(tmpDir, 'tts.mp3');
        await fs.writeFile(local, buf);
        audioPath = local;
      } else {
        console.error('[merge] fetch tts audio failed', {
          status: res.status,
          statusText: res.statusText,
          url: ttsArtifact.blobUrl,
        });
      }
    } catch (err: unknown) {
      console.error('[merge] fetch tts audio error', errorToString(err));
    }
  }

  // We render frames locally again to guarantee FFmpeg input without relying on Bunny.
  // This keeps merge deterministic even if Bunny is unavailable.
  const pagesArtifact = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.PAGES,
      type: ArtifactType.JSON,
    },
    orderBy: { version: 'desc' },
    select: { content: true, version: true },
  });

  const pages = (pagesArtifact?.content ?? {}) as {
    theme?: { primary?: string; background?: string; text?: string };
    slides?: Array<{ title?: string; bullets?: string[] }>;
  };
  const slides = Array.isArray(pages.slides) ? pages.slides : [];

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    for (let i = 0; i < Math.max(slides.length, 1); i++) {
      const slide = slides[i] ?? { title: '空白页', bullets: [] };
      const html = renderSlideHtml({
        title: String(slide.title ?? `Page ${i + 1}`),
        bullets: Array.isArray(slide.bullets) ? slide.bullets.map(String) : [],
        theme: pages.theme,
      });
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const filename = `frame-${String(i + 1).padStart(3, '0')}.png`;
      const filePath = path.join(tmpDir, filename);
      await page.screenshot({ path: filePath, type: 'png' });
    }
  } finally {
    await browser.close();
  }

  ffmpegImport.setFfmpegPath(ffmpegInstaller.path);

  await new Promise<void>((resolve, reject) => {
    const cmd = ffmpegImport().input(path.join(tmpDir, 'frame-%03d.png'));
    cmd.inputFPS(1);
    if (audioPath) {
      cmd.input(audioPath);
      cmd.outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-r 30',
        '-c:a aac',
        '-shortest',
      ]);
    } else {
      cmd.outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-r 30']);
    }
    cmd
      .on('end', () => resolve())
      .on('error', (err: unknown) =>
        reject(err instanceof Error ? err : new Error(String(err))),
      )
      .save(outPath);
  });

  let blobUrl: string | null = null;
  try {
    const data = await fs.readFile(outPath);
    const uploadPath = `jobs/${input.jobId}/artifacts/MERGE/v${renderVersion}.mp4`;
    const uploaded = await uploadBufferToBunny({
      path: uploadPath,
      contentType: 'video/mp4',
      data: new Uint8Array(data),
    });
    blobUrl = uploaded.publicUrl ?? uploaded.storageUrl;
  } catch (err: unknown) {
    console.error('[bunny] upload video failed', errorToString(err));
    blobUrl = null;
  }

  const latest = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      stage: JobStage.MERGE,
      type: ArtifactType.VIDEO,
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const videoMeta = {
    sourceRenderVersion: renderArtifact?.version ?? null,
  };

  const inputsHash = sha256(
    JSON.stringify({
      stage: JobStage.MERGE,
      sourceRenderVersion: renderArtifact?.version ?? null,
      render: renderArtifact?.content ?? {},
    }),
  );

  await prisma.artifact.create({
    data: {
      jobId: input.jobId,
      stage: JobStage.MERGE,
      type: ArtifactType.VIDEO,
      version: nextVersion,
      content: videoMeta,
      blobUrl,
      meta: {
        inputsHash,
        sourceRenderVersion: renderArtifact?.version ?? null,
      },
      createdBy: 'system',
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      currentStage: JobStage.MERGE,
      status: JobStatus.RUNNING,
    },
  });

  return { ...videoMeta, blobUrl };
}

export async function markStageApproved(jobId: string, stage: string) {
  const stageEnum = stage as JobStage;
  try {
    await prisma.approval.upsert({
      where: { jobId_stage: { jobId, stage: stageEnum } },
      update: { status: ApprovalStatus.APPROVED },
      create: {
        jobId,
        stage: stageEnum,
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
  stage: string,
  reason?: string,
) {
  const stageEnum = stage as JobStage;
  try {
    await prisma.approval.upsert({
      where: { jobId_stage: { jobId, stage: stageEnum } },
      update: { status: ApprovalStatus.REJECTED, comment: reason ?? null },
      create: {
        jobId,
        stage: stageEnum,
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

export async function markJobCompleted(jobId: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.COMPLETED,
      currentStage: JobStage.DONE,
    },
  });
}
