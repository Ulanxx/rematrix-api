import { Injectable, Logger } from '@nestjs/common';
import { PromptopsService } from './promptops.service';
import { JobStage } from '@prisma/client';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stage: JobStage;
}

export interface ValidationReport {
  total: number;
  valid: number;
  invalid: number;
  results: ValidationResult[];
}

@Injectable()
export class PromptopsValidationService {
  private readonly logger = new Logger(PromptopsValidationService.name);

  constructor(private readonly promptopsService: PromptopsService) {}

  /**
   * 验证单个阶段的配置
   */
  async validateStage(stage: JobStage): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const config = await this.promptopsService.getActiveConfig(stage);

      if (!config) {
        errors.push('没有找到活跃配置');
        return { valid: false, errors, warnings, stage };
      }

      // 验证必要字段
      if (!config.model || config.model.trim() === '') {
        errors.push('模型名称不能为空');
      }

      if (!config.prompt || config.prompt.trim() === '') {
        errors.push('Prompt 内容不能为空');
      } else {
        // Prompt 内容验证
        if (config.prompt.length < 10) {
          warnings.push('Prompt 内容过短，可能不够详细');
        }

        if (config.prompt.length > 10000) {
          warnings.push('Prompt 内容过长，可能影响性能');
        }

        // 检查是否包含必要的占位符
        const requiredPlaceholders = this.getRequiredPlaceholders(stage);
        const missingPlaceholders = requiredPlaceholders.filter(
          (placeholder) => !config.prompt.includes(placeholder),
        );

        if (missingPlaceholders.length > 0) {
          warnings.push(`缺少建议的占位符: ${missingPlaceholders.join(', ')}`);
        }

        // 检查是否使用了不推荐的占位符格式
        if (config.prompt.includes('{{') && config.prompt.includes('}}')) {
          warnings.push(
            '使用了不推荐的 {{...}} 占位符格式，建议使用 <...> 格式',
          );
        }
      }

      // 温度验证
      if (config.temperature !== null) {
        if (config.temperature < 0 || config.temperature > 2) {
          errors.push('温度值应在 0-2 之间');
        }
      }

      // 模型名称验证
      if (config.model && !config.model.includes('/')) {
        warnings.push('模型名称格式可能不正确，建议使用 provider/model 格式');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stage,
      };
    } catch (error) {
      this.logger.error(`验证阶段 ${stage} 时发生错误:`, error);
      errors.push(
        `验证过程中发生错误: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { valid: false, errors, warnings, stage };
    }
  }

  /**
   * 验证所有阶段的配置
   */
  async validateAllStages(): Promise<ValidationReport> {
    this.logger.log('开始验证所有 PromptOps 阶段配置...');

    const stages = Object.values(JobStage);
    const results: ValidationResult[] = [];

    for (const stage of stages) {
      const result = await this.validateStage(stage);
      results.push(result);
    }

    const valid = results.filter((r) => r.valid).length;
    const invalid = results.length - valid;

    this.logger.log(`验证完成: ${valid}/${results.length} 个阶段配置有效`);

    return {
      total: results.length,
      valid,
      invalid,
      results,
    };
  }

  /**
   * 获取阶段建议的占位符
   */
  private getRequiredPlaceholders(stage: JobStage): string[] {
    const placeholders: Record<JobStage, string[]> = {
      PLAN: ['<markdown>'],
      OUTLINE: ['<markdown>', '<plan_json>'],
      STORYBOARD: ['<outline_json>'],
      PAGES: ['<storyboard_json>'],
      DONE: ['<job_id>'],
    };

    return placeholders[stage] || [];
  }

  /**
   * 修复常见配置问题
   */
  async autoFixStage(stage: JobStage): Promise<boolean> {
    try {
      const config = await this.promptopsService.getActiveConfig(stage);

      if (!config) {
        this.logger.warn(`阶段 ${stage} 没有配置，无法自动修复`);
        return false;
      }

      const validation = await this.validateStage(stage);
      if (validation.valid) {
        this.logger.log(`阶段 ${stage} 配置有效，无需修复`);
        return true;
      }

      let needsUpdate = false;
      const updates: any = {};

      // 自动修复温度值
      if (
        config.temperature !== null &&
        (config.temperature < 0 || config.temperature > 2)
      ) {
        updates.temperature = config.temperature < 0 ? 0 : 2;
        needsUpdate = true;
        this.logger.log(
          `修复阶段 ${stage} 的温度值: ${config.temperature} -> ${updates.temperature}`,
        );
      }

      // 如果需要更新
      if (needsUpdate) {
        await this.promptopsService.updateConfig(config.id, updates);
        this.logger.log(`阶段 ${stage} 配置已自动修复`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`自动修复阶段 ${stage} 配置失败:`, error);
      return false;
    }
  }

  /**
   * 获取配置质量评分
   */
  async getQualityScore(stage: JobStage): Promise<number> {
    const validation = await this.validateStage(stage);

    if (!validation.valid) {
      return 0;
    }

    let score = 100;

    // 根据警告扣分
    score -= validation.warnings.length * 10;

    // 根据 Prompt 长度调整分数
    const config = await this.promptopsService.getActiveConfig(stage);
    if (config?.prompt) {
      if (config.prompt.length < 50) score -= 20;
      else if (config.prompt.length < 100) score -= 10;
      else if (config.prompt.length > 8000) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}
