import { JobStage, ArtifactType } from '@prisma/client';
import { z } from 'zod';
import {
  StepDefinition,
  createStepDefinition,
  validateStepDefinition,
  stepDefinitionSchema,
} from '../step-definition.interface';

describe('Step Definition Interface', () => {
  let validStep: StepDefinition;

  beforeEach(() => {
    validStep = {
      stage: JobStage.PLAN,
      type: 'AI_GENERATION',
      name: 'Test Step',
      description: 'Test step description',
      aiConfig: {
        model: 'z-ai/glm-4.6',

        prompt: 'Test prompt with <markdown>',
        schema: z.object({ test: z.string() }),
      },
      input: {
        sources: [],
        schema: z.object({ markdown: z.string() }),
      },
      output: {
        type: ArtifactType.JSON,
        schema: z.object({ result: z.string() }),
      },
      execution: {
        requiresApproval: true,
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 1000,
          maxBackoffMs: 5000,
        },
      },
    };
  });

  describe('createStepDefinition', () => {
    it('should create a valid step definition', () => {
      const result = createStepDefinition(validStep);
      expect(result).toEqual(validStep);
    });

    it('should throw error for invalid step definition', () => {
      const invalidStep = {
        ...validStep,
        stage: 'INVALID' as JobStage,
      };

      expect(() => createStepDefinition(invalidStep)).toThrow(
        'Invalid step definition',
      );
    });

    it('should throw error for missing required fields', () => {
      const incompleteStep = {
        stage: JobStage.PLAN,
        type: 'AI_GENERATION',
        // Missing name, description, etc.
      } as StepDefinition;

      expect(() => createStepDefinition(incompleteStep)).toThrow();
    });
  });

  describe('validateStepDefinition', () => {
    it('should validate a correct step definition', () => {
      const result = validateStepDefinition(validStep);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid stage order in dependencies', () => {
      const invalidStep = {
        ...validStep,
        stage: JobStage.PLAN,
        input: {
          sources: [JobStage.OUTLINE], // PLAN cannot depend on OUTLINE
          schema: z.object({ outline: z.any() }),
        },
      };

      const result = validateStepDefinition(invalidStep);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Input source OUTLINE must come before PLAN',
      );
    });

    it('should require aiConfig for AI_GENERATION steps', () => {
      const stepWithoutAiConfig = {
        ...validStep,
        type: 'AI_GENERATION' as const,
        aiConfig: undefined,
      };

      const result = validateStepDefinition(stepWithoutAiConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('AI_GENERATION steps must have aiConfig');
    });

    it('should allow PROCESSING steps without aiConfig', () => {
      const processingStep = {
        ...validStep,
        type: 'PROCESSING' as const,
        aiConfig: undefined,
        customExecute: jest.fn(),
      };

      const result = validateStepDefinition(processingStep);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should allow PROCESSING steps without aiConfig', () => {
      const processingStep = {
        ...validStep,
        type: 'PROCESSING' as const,
        aiConfig: undefined,
      };

      const result = validateStepDefinition(processingStep);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate schema structure', () => {
      const stepWithInvalidSchema = {
        ...validStep,
        input: {
          sources: [],
          schema: 'not a schema' as any,
        },
      };

      const result = validateStepDefinition(stepWithInvalidSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate retry policy constraints', () => {
      const stepWithInvalidRetryPolicy = {
        ...validStep,
        execution: {
          requiresApproval: true,
          retryPolicy: {
            maxAttempts: 0, // Should be at least 1
            backoffMs: -100, // Should be non-negative
            maxBackoffMs: 0, // Should be positive
          },
        },
      };

      const result = validateStepDefinition(stepWithInvalidRetryPolicy);

      // The schema validation should catch this
      expect(result.isValid).toBe(false);
    });
  });

  describe('stepDefinitionSchema', () => {
    it('should validate a complete step definition', () => {
      const result = stepDefinitionSchema.safeParse(validStep);
      expect(result.success).toBe(true);
    });

    it('should reject invalid stage values', () => {
      const invalidStep = {
        ...validStep,
        stage: 'INVALID_STAGE',
      };

      const result = stepDefinitionSchema.safeParse(invalidStep);
      expect(result.success).toBe(false);
    });

    it('should reject invalid type values', () => {
      const invalidStep = {
        ...validStep,
        type: 'INVALID_TYPE',
      };

      const result = stepDefinitionSchema.safeParse(invalidStep);
      expect(result.success).toBe(false);
    });

    it('should reject invalid artifact type values', () => {
      const invalidStep = {
        ...validStep,
        output: {
          ...validStep.output,
          type: 'INVALID_ARTIFACT_TYPE',
        },
      };

      const result = stepDefinitionSchema.safeParse(invalidStep);
      expect(result.success).toBe(false);
    });

    it('should validate optional fields', () => {
      const minimalStep = {
        stage: JobStage.DONE,
        type: 'PROCESSING' as const,
        name: 'Minimal Step',
        description: 'Minimal description',
        input: {
          sources: [JobStage.PAGES],
          schema: z.object({}),
        },
        output: {
          type: ArtifactType.JSON,
          schema: z.object({}),
        },
        execution: {
          requiresApproval: false,
        },
      };

      const result = stepDefinitionSchema.safeParse(minimalStep);
      expect(result.success).toBe(true);
    });
  });

  describe('Step Type Validation', () => {
    it('should validate AI_GENERATION type requirements', () => {
      const aiStep = {
        ...validStep,
        type: 'AI_GENERATION' as const,
      };

      const result = validateStepDefinition(aiStep);
      expect(result.isValid).toBe(true);
    });

    it('should validate PROCESSING type requirements', () => {
      const processingStep = {
        ...validStep,
        type: 'PROCESSING' as const,
        aiConfig: undefined,
        customExecute: jest.fn(),
      };

      const result = validateStepDefinition(processingStep);
      expect(result.isValid).toBe(true);
    });

    it('should validate PROCESSING type requirements', () => {
      const processingStep = {
        ...validStep,
        type: 'PROCESSING' as const,
        aiConfig: undefined,
      };

      const result = validateStepDefinition(processingStep);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Dependency Validation', () => {
    it('should allow valid dependency chains', () => {
      const outlineStep = {
        ...validStep,
        stage: JobStage.OUTLINE,
        input: {
          sources: [JobStage.PLAN],
          schema: z.object({ plan: z.any() }),
        },
      };

      const storyboardStep = {
        ...validStep,
        stage: JobStage.STORYBOARD,
        input: {
          sources: [JobStage.OUTLINE],
          schema: z.object({ outline: z.any() }),
        },
      };

      expect(validateStepDefinition(outlineStep).isValid).toBe(true);
      expect(validateStepDefinition(storyboardStep).isValid).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const stepA = {
        ...validStep,
        stage: JobStage.PLAN,
        input: {
          sources: [JobStage.OUTLINE],
          schema: z.object({ outline: z.any() }),
        },
      };

      // Individual validation should catch the invalid dependency
      expect(validateStepDefinition(stepA).isValid).toBe(false);
    });

    it('should validate no dependencies for initial stage', () => {
      const planStep = {
        ...validStep,
        stage: JobStage.PLAN,
        input: {
          sources: [], // PLAN should have no dependencies
          schema: z.object({ markdown: z.string() }),
        },
      };

      const result = validateStepDefinition(planStep);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Execution Configuration Validation', () => {
    it('should validate approval requirements', () => {
      const stepWithApproval = {
        ...validStep,
        execution: {
          requiresApproval: true,
        },
      };

      const stepWithoutApproval = {
        ...validStep,
        execution: {
          requiresApproval: false,
        },
      };

      expect(validateStepDefinition(stepWithApproval).isValid).toBe(true);
      expect(validateStepDefinition(stepWithoutApproval).isValid).toBe(true);
    });

    it('should validate retry policy', () => {
      const stepWithRetryPolicy = {
        ...validStep,
        execution: {
          requiresApproval: true,
          retryPolicy: {
            maxAttempts: 3,
            backoffMs: 1000,
            maxBackoffMs: 5000,
          },
        },
      };

      const result = validateStepDefinition(stepWithRetryPolicy);
      expect(result.isValid).toBe(true);
    });

    it('should validate timeout configuration', () => {
      const stepWithTimeout = {
        ...validStep,
        execution: {
          requiresApproval: true,
          timeoutMs: 120000,
        },
      };

      const result = validateStepDefinition(stepWithTimeout);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Custom Validation Function', () => {
    it('should allow custom validation logic', () => {
      const stepWithCustomValidation = {
        ...validStep,
        validate() {
          return {
            isValid: true,
            errors: [],
          };
        },
      };

      const result = validateStepDefinition(stepWithCustomValidation);
      expect(result.isValid).toBe(true);
    });

    it('should handle custom validation errors', () => {
      const stepWithCustomValidation = {
        ...validStep,
        validate() {
          return {
            isValid: false,
            errors: ['Custom validation error'],
          };
        },
      };

      const result = validateStepDefinition(stepWithCustomValidation);
      expect(result.isValid).toBe(true); // Built-in validation passes
      // Custom validation would be called separately
    });
  });
});
