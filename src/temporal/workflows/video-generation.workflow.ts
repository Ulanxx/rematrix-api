import {
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
  log,
  defineQuery,
} from '@temporalio/workflow';
import type { VideoGenerationInput } from '../activities/video-generation.activities';

const approveStage = defineSignal<[payload: { stage: string }]>('approveStage');
const rejectStage =
  defineSignal<[payload: { stage: string; reason?: string }]>('rejectStage');

// 定义查询接口用于调试
const getStatusQuery = defineQuery<{
  jobId: string;
  approved: Record<string, boolean>;
  rejected: Record<string, boolean>;
  rejectedReason: Record<string, string | undefined>;
  timestamp: string;
}>('getStatus');

const getApprovalStatusQuery = defineQuery<{
  plan: { approved: boolean; rejected: boolean; reason: string | undefined };
  pages: { approved: boolean; rejected: boolean; reason: string | undefined };
}>('getApprovalStatus');

const {
  runPlanStage,
  runOutlineStage,
  runStoryboardStage,
  runPagesStage,
  markStageApproved,
  markStageRejected,
  advanceAfterPlan,
  markJobCompleted,
} = proxyActivities<{
  runPlanStage: (input: VideoGenerationInput) => Promise<unknown>;
  runOutlineStage: (input: VideoGenerationInput) => Promise<unknown>;
  runStoryboardStage: (input: VideoGenerationInput) => Promise<unknown>;
  runPagesStage: (input: VideoGenerationInput) => Promise<unknown>;
  markStageApproved: (jobId: string, stage: string) => Promise<void>;
  markStageRejected: (
    jobId: string,
    stage: string,
    reason?: string,
  ) => Promise<void>;
  advanceAfterPlan: (jobId: string) => Promise<void>;
  markJobCompleted: (jobId: string) => Promise<void>;
}>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function videoGenerationWorkflow(input: VideoGenerationInput) {
  log.info('Starting video generation workflow', { jobId: input.jobId });

  const approved: Record<string, boolean> = {
    PLAN: false,
    PAGES: false,
  };
  const rejected: Record<string, boolean> = {
    PLAN: false,
    PAGES: false,
  };
  const rejectedReason: Record<string, string | undefined> = {
    PLAN: undefined,
    PAGES: undefined,
  };

  setHandler(approveStage, (payload) => {
    log.info('Received approval signal', {
      stage: payload.stage,
      jobId: input.jobId,
    });
    if (payload.stage in approved) {
      approved[payload.stage] = true;
      rejected[payload.stage] = false;
      rejectedReason[payload.stage] = undefined;
    }
  });

  setHandler(rejectStage, (payload) => {
    log.info('Received rejection signal', {
      stage: payload.stage,
      reason: payload.reason,
      jobId: input.jobId,
    });
    if (payload.stage in rejected) {
      approved[payload.stage] = false;
      rejected[payload.stage] = true;
      rejectedReason[payload.stage] = payload.reason;
    }
  });

  // 查询处理器 - 用于调试
  setHandler(getStatusQuery, () => {
    return {
      jobId: input.jobId,
      approved,
      rejected,
      rejectedReason,
      timestamp: new Date().toISOString(),
    };
  });

  setHandler(getApprovalStatusQuery, () => {
    return {
      plan: {
        approved: approved.PLAN,
        rejected: rejected.PLAN,
        reason: rejectedReason.PLAN,
      },
      pages: {
        approved: approved.PAGES,
        rejected: rejected.PAGES,
        reason: rejectedReason.PAGES,
      },
    };
  });

  async function waitForStageApproval(stage: 'PLAN' | 'PAGES') {
    log.info(`Waiting for ${stage} approval`, { jobId: input.jobId });

    while (true) {
      await condition(
        () => approved[stage] === true || rejected[stage] === true,
      );

      if (rejected[stage]) {
        log.warn(`${stage} was rejected`, {
          jobId: input.jobId,
          reason: rejectedReason[stage],
        });
        await markStageRejected(input.jobId, stage, rejectedReason[stage]);
        rejected[stage] = false;
        rejectedReason[stage] = undefined;
        continue;
      }

      if (approved[stage]) {
        log.info(`${stage} was approved`, { jobId: input.jobId });
        break;
      }
    }

    await markStageApproved(input.jobId, stage);
  }

  try {
    log.info('Starting PLAN stage', { jobId: input.jobId });
    await runPlanStage(input);

    log.info('Waiting for PLAN approval', { jobId: input.jobId });
    await waitForStageApproval('PLAN');

    log.info('Advancing after PLAN', { jobId: input.jobId });
    await advanceAfterPlan(input.jobId);

    log.info('Starting OUTLINE stage', { jobId: input.jobId });
    await runOutlineStage(input);

    log.info('Starting STORYBOARD stage', { jobId: input.jobId });
    await runStoryboardStage(input);

    log.info('Starting PAGES stage', { jobId: input.jobId });
    await runPagesStage(input);
    await waitForStageApproval('PAGES');

    log.info('Marking job as completed', { jobId: input.jobId });
    await markJobCompleted(input.jobId);

    log.info('Video generation workflow completed successfully', {
      jobId: input.jobId,
    });
    return {
      jobId: input.jobId,
      nextStage: 'DONE',
    };
  } catch (error) {
    log.error('Video generation workflow failed', {
      jobId: input.jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
