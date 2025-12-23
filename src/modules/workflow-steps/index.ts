// 接口和类型
export * from './step-definition.interface';

// 服务
export * from './step-registry.service';
export * from './step-executor.service';

// Step 定义
export { default as planStep } from './steps/plan.step';
export { default as outlineStep } from './steps/outline.step';
export { default as storyboardStep } from './steps/storyboard.step';
export { default as pagesStep } from './steps/pages.step';
export { default as doneStep } from './steps/done.step';

// 所有 Step 定义的数组，方便批量注册
import { planStep } from './steps/plan.step';
import { outlineStep } from './steps/outline.step';
import { storyboardStep } from './steps/storyboard.step';
import { pagesStep } from './steps/pages.step';
import { doneStep } from './steps/done.step';
import { StepDefinition } from './step-definition.interface';

export const allStepDefinitions: StepDefinition[] = [
  planStep,
  outlineStep,
  storyboardStep,
  pagesStep,
  doneStep,
];

// 按 JobStage 索引的 Step 定义映射
export const stepDefinitionsByStage = {
  PLAN: planStep,
  OUTLINE: outlineStep,
  STORYBOARD: storyboardStep,
  PAGES: pagesStep,
  DONE: doneStep,
};
