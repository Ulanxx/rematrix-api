import { Test, TestingModule } from '@nestjs/testing';
import { StepRegistryService } from '../step-registry.service';
import { StepExecutorService } from '../step-executor.service';
import { StepInitService } from '../step-init.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptopsService } from '../../promptops/promptops.service';
import { allStepDefinitions } from '../index';
import { JobStage, ArtifactType } from '@prisma/client';

describe('Workflow Steps Integration', () => {
  let module: TestingModule;
  let stepRegistry: StepRegistryService;
  let stepExecutor: StepExecutorService;
  let stepInit: StepInitService;
  let mockPrismaService: any;
  let mockPromptopsService: any;

  beforeEach(async () => {
    // Create comprehensive mocks
    mockPrismaService = {
      job: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ currentStage: 'DONE' }),
        update: jest.fn().mockResolvedValue({}),
      },
      artifact: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      approval: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    mockPromptopsService = {
      getActiveConfig: jest.fn().mockImplementation((stage) => {
        // Return mock config based on stage
        const configs = {
          [JobStage.PLAN]: {
            id: 'config-plan',
            model: 'z-ai/glm-4.6',

            prompt: 'Test plan prompt with <markdown>',
            tools: null,
            schema: null,
            meta: null,
          },
          [JobStage.OUTLINE]: {
            id: 'config-outline',
            model: 'z-ai/glm-4.6',

            prompt: 'Test outline prompt <markdown> <plan_json>',
            tools: null,
            schema: null,
            meta: null,
          },
        };
        return configs[stage] || null;
      }),
    };

    const testModule = await Test.createTestingModule({
      providers: [
        StepRegistryService,
        StepExecutorService,
        StepInitService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PromptopsService,
          useValue: mockPromptopsService,
        },
      ],
    }).compile();

    module = testModule;
    stepRegistry = module.get<StepRegistryService>(StepRegistryService);
    stepExecutor = module.get<StepExecutorService>(StepExecutorService);
    stepInit = module.get<StepInitService>(StepInitService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Step Registration and Initialization', () => {
    it('should initialize all steps successfully', async () => {
      await stepInit.onModuleInit();

      const stats = stepRegistry.getStats();
      expect(stats.total).toBe(5); // All 5 stages
      expect(stats.byType['AI_GENERATION']).toBe(4); // PLAN, OUTLINE, STORYBOARD, PAGES
      expect(stats.byType['PROCESSING']).toBe(1); // DONE
    });

    it('should validate all step dependencies', async () => {
      await stepInit.onModuleInit();

      const validation = stepRegistry.validateDependencies();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should register steps in correct execution order', async () => {
      await stepInit.onModuleInit();

      const stepsInOrder = stepRegistry.getStepsInExecutionOrder();
      const stages = stepsInOrder.map((step) => step.stage);

      expect(stages).toEqual([
        JobStage.PLAN,
        JobStage.OUTLINE,
        JobStage.STORYBOARD,
        JobStage.PAGES,
        JobStage.DONE,
      ]);
    });
  });

  describe('Step Dependencies', () => {
    beforeEach(async () => {
      await stepInit.onModuleInit();
    });

    it('should have correct dependencies for each stage', () => {
      expect(stepRegistry.getDependencies(JobStage.PLAN)).toEqual([]);
      expect(stepRegistry.getDependencies(JobStage.OUTLINE)).toContain(
        JobStage.PLAN,
      );
      expect(stepRegistry.getDependencies(JobStage.STORYBOARD)).toContain(
        JobStage.OUTLINE,
      );
      expect(stepRegistry.getDependencies(JobStage.PAGES)).toContain(
        JobStage.STORYBOARD,
      );
      expect(stepRegistry.getDependencies(JobStage.DONE)).toContain(
        JobStage.PAGES,
      );
    });

    it('should have correct dependents for each stage', () => {
      expect(stepRegistry.getDependents(JobStage.PLAN)).toContain(
        JobStage.OUTLINE,
      );
      expect(stepRegistry.getDependents(JobStage.OUTLINE)).toContain(
        JobStage.STORYBOARD,
      );
      expect(stepRegistry.getDependents(JobStage.STORYBOARD)).toContain(
        JobStage.PAGES,
      );
      expect(stepRegistry.getDependents(JobStage.PAGES)).toContain(
        JobStage.DONE,
      );
    });
  });

  describe('Step Execution Flow', () => {
    beforeEach(async () => {
      await stepInit.onModuleInit();
    });

    it('should execute PLAN stage successfully', async () => {
      // Mock AI generation
      jest.doMock('ai', () => ({
        generateObject: jest.fn().mockResolvedValue({
          object: {
            estimatedPages: 10,
            estimatedDurationSec: 120,
            style: 'professional',
            questions: [],
          },
        }),
      }));

      const result = await stepExecutor.execute(JobStage.PLAN, 'test-job-id', {
        content: 'Test markdown content',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(mockPrismaService.artifact.create).toHaveBeenCalled();
      expect(mockPrismaService.approval.upsert).toHaveBeenCalled();
    });

    it('should handle execution failure gracefully', async () => {
      // Mock AI generation failure
      jest.doMock('ai', () => ({
        generateObject: jest
          .fn()
          .mockRejectedValue(new Error('AI Service Error')),
      }));

      const result = await stepExecutor.execute(JobStage.PLAN, 'test-job-id', {
        content: 'Test markdown content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('AI Service Error');
      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'test-job-id' },
        data: {
          status: 'FAILED',
          currentStage: JobStage.PLAN,
          error: expect.any(String),
        },
      });
    });

    it('should reuse existing results when available', async () => {
      // Mock existing artifact and approval
      mockPrismaService.artifact.findFirst = jest.fn().mockResolvedValue({
        content: {
          estimatedPages: 10,
          estimatedDurationSec: 120,
          style: 'professional',
          questions: [],
        },
      });
      mockPrismaService.approval.findUnique = jest
        .fn()
        .mockResolvedValue({ status: 'APPROVED' });

      const result = await stepExecutor.execute(JobStage.PLAN, 'test-job-id', {
        content: 'Test markdown content',
      });

      expect(result.success).toBe(true);
      expect(result.output).toEqual({
        estimatedPages: 10,
        estimatedDurationSec: 120,
        style: 'professional',
        questions: [],
      });
      // Should not create new artifact
      expect(mockPrismaService.artifact.create).not.toHaveBeenCalled();
    });
  });

  describe('Step Configuration Validation', () => {
    beforeEach(async () => {
      await stepInit.onModuleInit();
    });

    it('should validate all step definitions', () => {
      const validationResults = stepRegistry.validateAll();

      expect(validationResults).toHaveLength(9);
      validationResults.forEach((result) => {
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    it('should have correct execution configurations', () => {
      const steps = stepRegistry.getAll();

      // Steps that require approval
      const approvalRequiredSteps = steps.filter(
        (step) => step.execution.requiresApproval,
      );
      expect(approvalRequiredSteps.map((s) => s.stage)).toContain(
        JobStage.PLAN,
      );
      expect(approvalRequiredSteps.map((s) => s.stage)).toContain(
        JobStage.PAGES,
      );

      // Steps that don't require approval
      const noApprovalSteps = steps.filter(
        (step) => !step.execution.requiresApproval,
      );
      expect(noApprovalSteps.map((s) => s.stage)).toContain(JobStage.OUTLINE);
      expect(noApprovalSteps.map((s) => s.stage)).toContain(
        JobStage.STORYBOARD,
      );
      expect(noApprovalSteps.map((s) => s.stage)).toContain(JobStage.DONE);
    });

    it('should have correct output types', () => {
      const steps = stepRegistry.getAll();

      const jsonSteps = steps.filter(
        (step) => step.output.type === ArtifactType.JSON,
      );
      // jsonSteps is used for testing output types
      expect(jsonSteps.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await stepInit.onModuleInit();
    });

    it('should handle missing step definition', async () => {
      // Clear the registry to simulate missing step
      stepRegistry.clear();

      const result = await stepExecutor.execute(JobStage.PLAN, 'test-job-id', {
        content: 'Test markdown content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No step definition found');
    });

    it('should handle invalid input data', async () => {
      const result = await stepExecutor.execute(
        JobStage.PLAN,
        'test-job-id',
        '', // Empty markdown should fail validation
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('should handle database errors', async () => {
      mockPrismaService.job.upsert = jest
        .fn()
        .mockRejectedValue(new Error('Database Error'));

      const result = await stepExecutor.execute(JobStage.PLAN, 'test-job-id', {
        content: 'Test markdown content',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database Error');
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await stepInit.onModuleInit();
    });

    it('should handle multiple step registrations efficiently', () => {
      const startTime = Date.now();

      // Register all steps again
      stepRegistry.registerBatch(allStepDefinitions);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (less than 100ms)
      expect(duration).toBeLessThan(100);

      const stats = stepRegistry.getStats();
      expect(stats.total).toBe(9);
    });

    it('should handle concurrent step lookups', async () => {
      const promises = Array(10)
        .fill(null)
        .map(() => Promise.resolve(stepRegistry.get(JobStage.PLAN)));

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result?.stage).toBe(JobStage.PLAN);
      });
    });
  });
});
