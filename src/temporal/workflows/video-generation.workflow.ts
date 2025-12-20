import {
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';
import type { VideoGenerationInput } from '../activities/video-generation.activities';

const approveStage = defineSignal<[payload: { stage: string }]>('approveStage');
const rejectStage =
  defineSignal<[payload: { stage: string; reason?: string }]>('rejectStage');

const {
  runPlanStage,
  runOutlineStage,
  runStoryboardStage,
  runNarrationStage,
  runPagesStage,
  runTtsStage,
  runRenderStage,
  runMergeStage,
  markStageApproved,
  markStageRejected,
  advanceAfterPlan,
  markJobCompleted,
} = proxyActivities<{
  runPlanStage: (input: VideoGenerationInput) => Promise<unknown>;
  runOutlineStage: (input: VideoGenerationInput) => Promise<unknown>;
  runStoryboardStage: (input: VideoGenerationInput) => Promise<unknown>;
  runNarrationStage: (input: VideoGenerationInput) => Promise<unknown>;
  runPagesStage: (input: VideoGenerationInput) => Promise<unknown>;
  runTtsStage: (input: VideoGenerationInput) => Promise<unknown>;
  runRenderStage: (input: VideoGenerationInput) => Promise<unknown>;
  runMergeStage: (input: VideoGenerationInput) => Promise<unknown>;
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
  const approved: Record<string, boolean> = {
    PLAN: false,
    NARRATION: false,
    PAGES: false,
  };
  const rejected: Record<string, boolean> = {
    PLAN: false,
    NARRATION: false,
    PAGES: false,
  };
  const rejectedReason: Record<string, string | undefined> = {
    PLAN: undefined,
    NARRATION: undefined,
    PAGES: undefined,
  };

  setHandler(approveStage, (payload) => {
    if (payload.stage in approved) {
      approved[payload.stage] = true;
      rejected[payload.stage] = false;
      rejectedReason[payload.stage] = undefined;
    }
  });

  setHandler(rejectStage, (payload) => {
    if (payload.stage in rejected) {
      approved[payload.stage] = false;
      rejected[payload.stage] = true;
      rejectedReason[payload.stage] = payload.reason;
    }
  });

  async function waitForStageApproval(stage: 'PLAN' | 'NARRATION' | 'PAGES') {
    while (true) {
      await condition(
        () => approved[stage] === true || rejected[stage] === true,
      );

      if (rejected[stage]) {
        await markStageRejected(input.jobId, stage, rejectedReason[stage]);
        rejected[stage] = false;
        rejectedReason[stage] = undefined;
        continue;
      }

      if (approved[stage]) break;
    }

    await markStageApproved(input.jobId, stage);
  }

  await runPlanStage(input);

  await waitForStageApproval('PLAN');
  await advanceAfterPlan(input.jobId);
  await runOutlineStage(input);

  await runStoryboardStage(input);

  await runNarrationStage(input);
  await waitForStageApproval('NARRATION');

  await runPagesStage(input);
  await waitForStageApproval('PAGES');

  await runTtsStage(input);

  await runRenderStage(input);
  await runMergeStage(input);

  await markJobCompleted(input.jobId);

  return {
    jobId: input.jobId,
    nextStage: 'DONE',
  };
}
