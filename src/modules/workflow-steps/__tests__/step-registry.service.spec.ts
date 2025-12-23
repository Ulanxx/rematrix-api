import { Test, TestingModule } from '@nestjs/testing';
import { StepRegistryService } from '../step-registry.service';
import {
  StepDefinition,
  createStepDefinition,
} from '../step-definition.interface';
import { JobStage, ArtifactType } from '@prisma/client';
import { z } from 'zod';

describe('StepRegistryService', () => {
  let service: StepRegistryService;
  let mockStep: StepDefinition;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StepRegistryService],
    }).compile();

    service = module.get<StepRegistryService>(StepRegistryService);

    // 创建一个测试用的 Step 定义
    mockStep = createStepDefinition({
      stage: JobStage.PLAN,
      type: 'AI_GENERATION',
      name: 'Test Plan Step',
      description: 'Test step for unit testing',
      aiConfig: {
        model: 'z-ai/glm-4.6',

        prompt: 'Test prompt',
        schema: z.object({ test: z.string() }),
      },
      input: {
        sources: [],
        schema: z.object({ markdown: z.string() }),
      },
      output: {
        type: ArtifactType.JSON,
        schema: z.object({ test: z.string() }),
      },
      execution: {
        requiresApproval: true,
      },
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a valid step', () => {
      service.register(mockStep);

      const retrieved = service.get(JobStage.PLAN);
      expect(retrieved).toBeDefined();
      expect(retrieved?.stage).toBe(JobStage.PLAN);
      expect(retrieved?.name).toBe('Test Plan Step');
    });

    it('should throw error for invalid step', () => {
      const invalidStep = {
        ...mockStep,
        stage: 'INVALID' as JobStage,
      };

      expect(() => service.register(invalidStep)).toThrow();
    });

    it('should overwrite existing step when registering same stage', () => {
      service.register(mockStep);

      const newStep = {
        ...mockStep,
        name: 'Updated Plan Step',
      };

      service.register(newStep);

      const retrieved = service.get(JobStage.PLAN);
      expect(retrieved?.name).toBe('Updated Plan Step');
    });
  });

  describe('registerBatch', () => {
    it('should register multiple steps', () => {
      const steps = [mockStep];

      service.registerBatch(steps);

      expect(service.get(JobStage.PLAN)).toBeDefined();
      expect(service.getStages()).toContain(JobStage.PLAN);
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent stage', () => {
      const result = service.get(JobStage.OUTLINE);
      expect(result).toBeUndefined();
    });

    it('should return registered step', () => {
      service.register(mockStep);

      const result = service.get(JobStage.PLAN);
      expect(result).toBeDefined();
      expect(result?.stage).toBe(JobStage.PLAN);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no steps registered', () => {
      const result = service.getAll();
      expect(result).toEqual([]);
    });

    it('should return all registered steps', () => {
      service.register(mockStep);

      const result = service.getAll();
      expect(result).toHaveLength(1);
      expect(result[0].stage).toBe(JobStage.PLAN);
    });
  });

  describe('getStages', () => {
    it('should return empty array when no steps registered', () => {
      const result = service.getStages();
      expect(result).toEqual([]);
    });

    it('should return all registered stages', () => {
      service.register(mockStep);

      const result = service.getStages();
      expect(result).toContain(JobStage.PLAN);
    });
  });

  describe('has', () => {
    it('should return false for non-existent stage', () => {
      expect(service.has(JobStage.OUTLINE)).toBe(false);
    });

    it('should return true for registered stage', () => {
      service.register(mockStep);

      expect(service.has(JobStage.PLAN)).toBe(true);
    });
  });

  describe('unregister', () => {
    it('should return false for non-existent stage', () => {
      const result = service.unregister(JobStage.OUTLINE);
      expect(result).toBe(false);
    });

    it('should unregister existing stage', () => {
      service.register(mockStep);

      const result = service.unregister(JobStage.PLAN);
      expect(result).toBe(true);
      expect(service.has(JobStage.PLAN)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all registered steps', () => {
      service.register(mockStep);
      expect(service.has(JobStage.PLAN)).toBe(true);

      service.clear();
      expect(service.has(JobStage.PLAN)).toBe(false);
      expect(service.getAll()).toEqual([]);
    });
  });

  describe('getRegistrationInfo', () => {
    it('should return undefined for non-existent stage', () => {
      const result = service.getRegistrationInfo(JobStage.OUTLINE);
      expect(result).toBeUndefined();
    });

    it('should return registration info for registered stage', () => {
      service.register(mockStep);

      const result = service.getRegistrationInfo(JobStage.PLAN);
      expect(result).toBeDefined();
      expect(result?.definition.stage).toBe(JobStage.PLAN);
      expect(result?.registeredAt).toBeInstanceOf(Date);
    });
  });

  describe('validateAll', () => {
    it('should return empty validation for no steps', () => {
      const result = service.validateAll();
      expect(result).toEqual([]);
    });

    it('should return validation results for all steps', () => {
      service.register(mockStep);

      const result = service.validateAll();
      expect(result).toHaveLength(1);
      expect(result[0].stage).toBe(JobStage.PLAN);
      expect(result[0].isValid).toBe(true);
      expect(result[0].errors).toEqual([]);
    });
  });

  describe('getStepsInExecutionOrder', () => {
    it('should return steps in correct execution order', () => {
      // 注册多个步骤
      const outlineStep = createStepDefinition({
        stage: JobStage.OUTLINE,
        type: 'AI_GENERATION',
        name: 'Test Outline Step',
        description: 'Test step',
        aiConfig: {
          model: 'z-ai/glm-4.6',

          prompt: 'Test prompt',
          schema: z.object({ test: z.string() }),
        },
        input: {
          sources: [JobStage.PLAN],
          schema: z.object({ plan: z.any() }),
        },
        output: {
          type: ArtifactType.JSON,
          schema: z.object({ test: z.string() }),
        },
        execution: {
          requiresApproval: false,
        },
      });

      service.register(mockStep);
      service.register(outlineStep);

      const result = service.getStepsInExecutionOrder();
      expect(result).toHaveLength(2);
      expect(result[0].stage).toBe(JobStage.PLAN);
      expect(result[1].stage).toBe(JobStage.OUTLINE);
    });
  });

  describe('getDependencies', () => {
    it('should return empty array for step with no dependencies', () => {
      service.register(mockStep);

      const result = service.getDependencies(JobStage.PLAN);
      expect(result).toEqual([]);
    });

    it('should return dependencies for step', () => {
      const outlineStep = createStepDefinition({
        stage: JobStage.OUTLINE,
        type: 'AI_GENERATION',
        name: 'Test Outline Step',
        description: 'Test step',
        aiConfig: {
          model: 'z-ai/glm-4.6',

          prompt: 'Test prompt',
          schema: z.object({ test: z.string() }),
        },
        input: {
          sources: [JobStage.PLAN],
          schema: z.object({ plan: z.any() }),
        },
        output: {
          type: ArtifactType.JSON,
          schema: z.object({ test: z.string() }),
        },
        execution: {
          requiresApproval: false,
        },
      });

      service.register(mockStep);
      service.register(outlineStep);

      const result = service.getDependencies(JobStage.OUTLINE);
      expect(result).toContain(JobStage.PLAN);
    });
  });

  describe('getDependents', () => {
    it('should return empty array for step with no dependents', () => {
      service.register(mockStep);

      const result = service.getDependents(JobStage.PLAN);
      expect(result).toEqual([]);
    });

    it('should return dependents for step', () => {
      const outlineStep = createStepDefinition({
        stage: JobStage.OUTLINE,
        type: 'AI_GENERATION',
        name: 'Test Outline Step',
        description: 'Test step',
        aiConfig: {
          model: 'z-ai/glm-4.6',

          prompt: 'Test prompt',
          schema: z.object({ test: z.string() }),
        },
        input: {
          sources: [JobStage.PLAN],
          schema: z.object({ plan: z.any() }),
        },
        output: {
          type: ArtifactType.JSON,
          schema: z.object({ test: z.string() }),
        },
        execution: {
          requiresApproval: false,
        },
      });

      service.register(mockStep);
      service.register(outlineStep);

      const result = service.getDependents(JobStage.PLAN);
      expect(result).toContain(JobStage.OUTLINE);
    });
  });

  describe('validateDependencies', () => {
    it('should validate correct dependencies', () => {
      const outlineStep = createStepDefinition({
        stage: JobStage.OUTLINE,
        type: 'AI_GENERATION',
        name: 'Test Outline Step',
        description: 'Test step',
        aiConfig: {
          model: 'z-ai/glm-4.6',

          prompt: 'Test prompt',
          schema: z.object({ test: z.string() }),
        },
        input: {
          sources: [JobStage.PLAN],
          schema: z.object({ plan: z.any() }),
        },
        output: {
          type: ArtifactType.JSON,
          schema: z.object({ test: z.string() }),
        },
        execution: {
          requiresApproval: false,
        },
      });

      service.register(mockStep);
      service.register(outlineStep);

      const result = service.validateDependencies();
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid dependencies', () => {
      const invalidStep = createStepDefinition({
        stage: JobStage.PLAN,
        type: 'AI_GENERATION',
        name: 'Invalid Step',
        description: 'Test step',
        aiConfig: {
          model: 'z-ai/glm-4.6',

          prompt: 'Test prompt',
          schema: z.object({ test: z.string() }),
        },
        input: {
          sources: [JobStage.OUTLINE], // PLAN 不能依赖 OUTLINE
          schema: z.object({ outline: z.any() }),
        },
        output: {
          type: ArtifactType.JSON,
          schema: z.object({ test: z.string() }),
        },
        execution: {
          requiresApproval: false,
        },
      });

      service.register(invalidStep);

      const result = service.validateDependencies();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const outlineStep = createStepDefinition({
        stage: JobStage.OUTLINE,
        type: 'PROCESSING',
        name: 'Test Outline Step',
        description: 'Test step',
        input: {
          sources: [JobStage.PLAN],
          schema: z.object({ plan: z.any() }),
        },
        output: {
          type: ArtifactType.JSON,
          schema: z.object({ test: z.string() }),
        },
        execution: {
          requiresApproval: false,
        },
      });

      service.register(mockStep); // AI_GENERATION, requires approval
      service.register(outlineStep); // PROCESSING, no approval

      const result = service.getStats();
      expect(result.total).toBe(2);
      expect(result.byType['AI_GENERATION']).toBe(1);
      expect(result.byType['PROCESSING']).toBe(1);
      expect(result.byApproval.requires).toBe(1);
      expect(result.byApproval.notRequires).toBe(1);
    });
  });
});
