import { planStep } from '../steps/plan.step';
import { validateStepDefinition } from '../step-definition.interface';
import { JobStage, ArtifactType } from '@prisma/client';

describe('Plan Step', () => {
  it('should be properly defined', () => {
    expect(planStep.stage).toBe(JobStage.PLAN);
    expect(planStep.type).toBe('AI_GENERATION');
    expect(planStep.name).toBe('Plan Generation');
    expect(planStep.description).toContain('视频制作计划');
  });

  it('should have correct AI configuration', () => {
    expect(planStep.aiConfig).toBeDefined();
    expect(planStep.aiConfig?.model).toBe('z-ai/glm-4.6');
    expect(planStep.aiConfig?.temperature).toBe(0.7);
    expect(planStep.aiConfig?.prompt).toContain('根据 <markdown> 生成');
    expect(planStep.aiConfig?.prompt).toContain('<markdown>');
  });

  it('should have no input dependencies', () => {
    expect(planStep.input.sources).toEqual([]);
  });

  it('should have correct input schema', () => {
    const validInput = { markdown: 'Test content' };
    const result = planStep.input.schema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid input', () => {
    const invalidInput = { markdown: '' }; // Empty string
    const result = planStep.input.schema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should have correct output schema', () => {
    const validOutput = {
      estimatedPages: 10,
      estimatedDurationSec: 120,
      style: 'professional',
      questions: ['Question 1', 'Question 2'],
    };
    const result = planStep.output.schema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid output', () => {
    const invalidOutput = {
      estimatedPages: 0, // Too small
      estimatedDurationSec: 5, // Too small
      style: '', // Empty string
    };
    const result = planStep.output.schema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  it('should require approval', () => {
    expect(planStep.execution.requiresApproval).toBe(true);
  });

  it('should have retry policy', () => {
    expect(planStep.execution.retryPolicy).toBeDefined();
    expect(stepStep.execution.retryPolicy?.maxAttempts).toBe(3);
    expect(stepStep.execution.retryPolicy?.backoffMs).toBe(1000);
    expect(stepStep.execution.retryPolicy?.maxBackoffMs).toBe(5000);
  });

  it('should have timeout configuration', () => {
    expect(stepStep.execution.timeoutMs).toBe(120000);
  });

  it('should pass validation', () => {
    const result = validateStepDefinition(planStep);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should have correct output type', () => {
    expect(stepStep.output.type).toBe(ArtifactType.JSON);
  });

  it('should have custom validation function', () => {
    expect(typeof stepStep.validate).toBe('function');

    const validationResult = stepStep.validate!();
    expect(validationResult.isValid).toBe(true);
    expect(validationResult.errors).toEqual([]);
  });

  it('should validate estimated pages constraints', () => {
    const invalidOutput = {
      estimatedPages: 50, // Exceeds max 40
      estimatedDurationSec: 120,
      style: 'professional',
      questions: [],
    };
    const result = stepStep.output.schema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  it('should validate duration constraints', () => {
    const invalidOutput = {
      estimatedPages: 10,
      estimatedDurationSec: 700, // Exceeds max 600
      style: 'professional',
      questions: [],
    };
    const result = stepStep.output.schema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });

  it('should allow empty questions array', () => {
    const validOutput = {
      estimatedPages: 10,
      estimatedDurationSec: 120,
      style: 'professional',
      questions: [], // Empty array should be valid
    };
    const result = stepStep.output.schema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it('should have correct metadata', () => {
    expect(stepStep.aiConfig?.meta).toBeDefined();
    expect(stepStep.aiConfig?.meta?.category).toBe('planning');
    expect(stepStep.aiConfig?.meta?.complexity).toBe('medium');
    expect(stepStep.aiConfig?.meta?.estimatedTokens).toBe(500);
  });
});
