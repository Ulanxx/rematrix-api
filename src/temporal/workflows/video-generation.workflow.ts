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
  markStageApproved,
  markStageRejected,
  advanceAfterPlan,
} = proxyActivities<{
  runPlanStage: (input: VideoGenerationInput) => Promise<unknown>;
  runOutlineStage: (input: VideoGenerationInput) => Promise<unknown>;
  markStageApproved: (jobId: string, stage: 'PLAN') => Promise<void>;
  markStageRejected: (
    jobId: string,
    stage: 'PLAN',
    reason?: string,
  ) => Promise<void>;
  advanceAfterPlan: (jobId: string) => Promise<void>;
}>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

export async function videoGenerationWorkflow(input: VideoGenerationInput) {
  let planApproved = false;
  let planRejected = false;
  let rejectedReason: string | undefined;

  setHandler(approveStage, (payload) => {
    if (payload.stage === 'PLAN') {
      planApproved = true;
      planRejected = false;
      rejectedReason = undefined;
    }
  });

  setHandler(rejectStage, (payload) => {
    if (payload.stage === 'PLAN') {
      planApproved = false;
      planRejected = true;
      rejectedReason = payload.reason;
    }
  });

  await runPlanStage(input);

  while (true) {
    await condition(() => planApproved === true || planRejected === true);

    if (planRejected) {
      await markStageRejected(input.jobId, 'PLAN', rejectedReason);
      planRejected = false;
      rejectedReason = undefined;
      continue;
    }

    if (planApproved) break;
  }

  await markStageApproved(input.jobId, 'PLAN');
  await advanceAfterPlan(input.jobId);
  await runOutlineStage(input);

  return {
    jobId: input.jobId,
    nextStage: 'OUTLINE',
  };
}
