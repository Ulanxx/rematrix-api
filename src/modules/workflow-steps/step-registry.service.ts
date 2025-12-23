import { Injectable, Logger } from '@nestjs/common';
import { JobStage } from '@prisma/client';
import {
  StepDefinition,
  RegisteredStep,
  validateStepDefinition,
} from './step-definition.interface';

/**
 * Step 注册表服务
 * 负责管理所有工作流步骤的定义和注册
 */
@Injectable()
export class StepRegistryService {
  private readonly logger = new Logger(StepRegistryService.name);
  private readonly steps = new Map<JobStage, RegisteredStep>();

  constructor() {
    this.logger.log('StepRegistry initialized');
  }

  /**
   * 注册一个新的 Step 定义
   */
  register(definition: StepDefinition): void {
    this.logger.log(`Registering step: ${definition.stage}`);

    // 验证定义
    const validation = validateStepDefinition(definition);
    if (!validation.isValid) {
      throw new Error(
        `Invalid step definition for ${definition.stage}: ${validation.errors.join(', ')}`,
      );
    }

    // 检查是否已存在
    if (this.steps.has(definition.stage)) {
      this.logger.warn(
        `Step ${definition.stage} is already registered, overwriting`,
      );
    }

    // 注册步骤
    const registeredStep: RegisteredStep = {
      definition,
      registeredAt: new Date(),
    };

    this.steps.set(definition.stage, registeredStep);
    this.logger.log(`Successfully registered step: ${definition.stage}`);
  }

  /**
   * 批量注册多个 Step 定义
   */
  registerBatch(definitions: StepDefinition[]): void {
    this.logger.log(`Registering ${definitions.length} steps in batch`);

    for (const definition of definitions) {
      this.register(definition);
    }

    this.logger.log(
      `Batch registration completed. Total registered steps: ${this.steps.size}`,
    );
  }

  /**
   * 获取指定阶段的 Step 定义
   */
  get(stage: JobStage): StepDefinition | undefined {
    const registeredStep = this.steps.get(stage);
    return registeredStep?.definition;
  }

  /**
   * 获取所有已注册的 Step 定义
   */
  getAll(): StepDefinition[] {
    return Array.from(this.steps.values()).map((rs) => rs.definition);
  }

  /**
   * 获取所有已注册的阶段
   */
  getStages(): JobStage[] {
    return Array.from(this.steps.keys());
  }

  /**
   * 检查指定阶段是否已注册
   */
  has(stage: JobStage): boolean {
    return this.steps.has(stage);
  }

  /**
   * 注销指定阶段的 Step
   */
  unregister(stage: JobStage): boolean {
    const existed = this.steps.has(stage);
    if (existed) {
      this.steps.delete(stage);
      this.logger.log(`Unregistered step: ${stage}`);
    }
    return existed;
  }

  /**
   * 清空所有注册的 Step
   */
  clear(): void {
    const count = this.steps.size;
    this.steps.clear();
    this.logger.log(`Cleared ${count} registered steps`);
  }

  /**
   * 获取指定阶段的注册信息
   */
  getRegistrationInfo(stage: JobStage): RegisteredStep | undefined {
    return this.steps.get(stage);
  }

  /**
   * 验证所有已注册的 Step
   */
  validateAll(): { stage: JobStage; isValid: boolean; errors: string[] }[] {
    const results: { stage: JobStage; isValid: boolean; errors: string[] }[] =
      [];

    for (const [stage, registeredStep] of this.steps) {
      const validation = validateStepDefinition(registeredStep.definition);
      results.push({
        stage,
        isValid: validation.isValid,
        errors: validation.errors,
      });
    }

    return results;
  }

  /**
   * 获取按执行顺序排序的 Step 定义列表
   */
  getStepsInExecutionOrder(): StepDefinition[] {
    const stageOrder: JobStage[] = [
      'PLAN',
      'OUTLINE',
      'STORYBOARD',
      'PAGES',
      'DONE',
    ];

    const orderedSteps: StepDefinition[] = [];

    for (const stage of stageOrder) {
      const step = this.get(stage);
      if (step) {
        orderedSteps.push(step);
      }
    }

    return orderedSteps;
  }

  /**
   * 获取指定阶段的直接依赖（输入源）
   */
  getDependencies(stage: JobStage): JobStage[] {
    const step = this.get(stage);
    return step?.input.sources || [];
  }

  /**
   * 获取依赖于指定阶段的所有阶段
   */
  getDependents(stage: JobStage): JobStage[] {
    const dependents: JobStage[] = [];

    for (const step of this.getAll()) {
      if (step.input.sources.includes(stage)) {
        dependents.push(step.stage);
      }
    }

    return dependents;
  }

  /**
   * 验证阶段依赖关系是否正确
   */
  validateDependencies(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stageOrder: JobStage[] = [
      'PLAN',
      'OUTLINE',
      'STORYBOARD',
      'PAGES',
      'DONE',
    ];
    const stageIndexMap = new Map(
      stageOrder.map((stage, index) => [stage, index]),
    );

    for (const step of this.getAll()) {
      const stepIndex = stageIndexMap.get(step.stage);
      if (stepIndex === undefined) continue;

      for (const dependency of step.input.sources) {
        const depIndex = stageIndexMap.get(dependency);
        if (depIndex === undefined) continue;

        if (depIndex >= stepIndex) {
          errors.push(
            `Step ${step.stage} cannot depend on ${dependency} (same or later stage)`,
          );
        }
      }
    }

    // 检查循环依赖
    const visited = new Set<JobStage>();
    const recursionStack = new Set<JobStage>();

    const hasCycle = (stage: JobStage): boolean => {
      if (recursionStack.has(stage)) return true;
      if (visited.has(stage)) return false;

      visited.add(stage);
      recursionStack.add(stage);

      const dependencies = this.getDependencies(stage);
      for (const dep of dependencies) {
        if (hasCycle(dep)) return true;
      }

      recursionStack.delete(stage);
      return false;
    };

    for (const stage of this.getStages()) {
      if (hasCycle(stage)) {
        errors.push(`Circular dependency detected involving stage ${stage}`);
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取注册统计信息
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    byApproval: { requires: number; notRequires: number };
  } {
    const steps = this.getAll();
    const byType: Record<string, number> = {};
    let requiresApproval = 0;
    let notRequiresApproval = 0;

    for (const step of steps) {
      // 按类型统计
      byType[step.type] = (byType[step.type] || 0) + 1;

      // 按审批需求统计
      if (step.execution.requiresApproval) {
        requiresApproval++;
      } else {
        notRequiresApproval++;
      }
    }

    return {
      total: steps.length,
      byType,
      byApproval: {
        requires: requiresApproval,
        notRequires: notRequiresApproval,
      },
    };
  }
}
