import { JobsService } from './jobs.service';

describe('JobsService', () => {
  it('create/run/approve/reject - happy path (mocked)', async () => {
    const prisma: any = {
      job: {
        create: jest.fn((args: unknown) => {
          const record = args as { data?: Record<string, unknown> };
          return Promise.resolve({ id: 'job-1', ...(record.data ?? {}) });
        }),
        findUnique: jest.fn((args: unknown) => {
          const record = args as { where?: { id?: string } };
          if (record.where?.id !== 'job-1') return Promise.resolve(null);
          return {
            id: 'job-1',
            status: 'WAITING_APPROVAL',
            currentStage: 'OUTLINE',
            config: { markdown: '# hi' },
          };
        }),
      },
      approval: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            stage: 'PLAN',
            status: 'APPROVED',
            comment: null,
          }),
        ),
      },
    };

    const temporal = {
      startVideoGeneration: jest.fn(() =>
        Promise.resolve({
          workflowId: 'video-generation-job-1',
          runId: 'run-1',
        }),
      ),
      signalApprove: jest.fn(() => Promise.resolve(undefined)),
      signalReject: jest.fn(() => Promise.resolve(undefined)),
    };

    const service = new JobsService(
      prisma as unknown as ConstructorParameters<typeof JobsService>[0],
      temporal as unknown as ConstructorParameters<typeof JobsService>[1],
    );

    const created = await service.create({ markdown: '# hi' });
    expect(created.id).toBe('job-1');

    const runRes = await service.run('job-1');
    expect(runRes.workflowId).toContain('video-generation-');

    const approveRes = await service.approve('job-1', 'PLAN');
    expect(approveRes.ok).toBe(true);

    // mock reject: simulate approval is REJECTED
    prisma.approval.findUnique = jest.fn(
      () =>
        Promise.resolve({
          stage: 'PLAN',
          status: 'REJECTED',
          comment: 'x',
        }) as unknown,
    ) as unknown;
    const rejectRes = await service.reject('job-1', 'PLAN', 'x');
    expect(rejectRes.ok).toBe(true);

    expect(temporal.signalApprove).toHaveBeenCalled();
    expect(temporal.signalReject).toHaveBeenCalled();
  });
});
