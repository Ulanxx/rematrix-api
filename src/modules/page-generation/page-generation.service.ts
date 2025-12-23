import { Injectable, BadRequestException } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

@Injectable()
export class PageGenerationService {
  private openai: ReturnType<typeof createOpenAI>;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY');
    }

    this.openai = createOpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async generateSlideHtml(params: {
    title: string;
    bullets: string[];
    theme?: { primary?: string; background?: string; text?: string };
    context?: string; // 来自 STORYBOARD 和 NARRATION 的上下文
  }): Promise<{ html: string; css: string }> {
    const model = this.openai('z-ai/glm-4.6');

    const slideSchema = z.object({
      html: z.string().min(1),
      css: z.string().min(1),
      description: z.string().optional(),
    });

    const prompt = this.buildSlidePrompt(params);

    try {
      const { object } = await generateObject({
        model,

        schema: slideSchema,
        prompt,
      });

      return {
        html: object.html,
        css: object.css,
      };
    } catch (error) {
      console.error('Failed to generate slide HTML:', error);
      // 回退到基础模板
      return await this.generateFallbackSlide(params);
    }
  }

  private buildSlidePrompt(params: {
    title: string;
    bullets: string[];
    theme?: { primary?: string; background?: string; text?: string };
    context?: string;
  }): string {
    const { title, bullets, theme, context } = params;

    let prompt = `你是一个专业的网页设计师，需要生成一个精美的幻灯片页面。

## 任务要求
生成一个完整的 HTML 页面，包含内联 CSS 样式，用于显示幻灯片内容。

## 内容信息
- 标题：${title}
- 要点：${bullets.join(', ')}

## 设计要求
- 页面尺寸：1280x720 像素
- 设计风格：现代、专业、易读
- 布局：标题突出，要点清晰排列
- 交互：静态展示，无需动画`;

    if (theme) {
      prompt += `

## 主题色彩
- 主色：${theme.primary || '#4285F4'}
- 背景色：${theme.background || '#F8F9FA'}
- 文字色：${theme.text || '#202124'}`;
    }

    if (context) {
      prompt += `

## 上下文信息
${context}`;
    }

    prompt += `

## 输出格式
请返回 JSON 格式，包含以下字段：
- html: 完整的 HTML 代码（包含 doctype、html、head、body 标签）
- css: CSS 样式代码（可以内联在 HTML 中）
- description: 设计说明（可选）

## 技术要求
- 使用语义化 HTML5 标签
- CSS 使用现代布局技术（Flexbox 或 Grid）
- 确保文字清晰可读
- 保持视觉层次感
- 代码结构清晰，易于维护

请生成一个专业、美观的幻灯片页面。`;

    return prompt;
  }

  private async generateFallbackSlide(params: {
    title: string;
    bullets: string[];
    theme?: { primary?: string; background?: string; text?: string };
  }): Promise<{ html: string; css: string }> {
    const model = this.openai('z-ai/glm-4.6');
    const themeColors = {
      primary: params.theme?.primary ?? '#4285F4',
      background: params.theme?.background ?? '#F8F9FA',
      text: params.theme?.text ?? '#202124',
    };

    const slideSchema = z.object({
      html: z.string().describe('完整的 HTML 代码'),
      css: z.string().describe('CSS 样式代码'),
    });

    const prompt = `你是一名专业的网页设计师，需要根据以下内容创建一个独特、美观的幻灯片页面。

## 内容信息
标题: ${params.title}
要点: ${params.bullets.join('\n')}

## 设计要求
- 主色调: ${themeColors.primary}
- 背景色: ${themeColors.background}
- 文字颜色: ${themeColors.text}

## 设计原则
1. **独特性**: 不要使用固定模板，根据内容特点设计独特的布局
2. **美观性**: 现代化设计，视觉层次清晰
3. **可读性**: 确保文字清晰易读
4. **响应式**: 适配不同屏幕尺寸
5. **创意性**: 根据内容主题添加适当的视觉元素

## 技术要求
- 使用语义化 HTML5 标签
- CSS 使用现代布局技术（Flexbox 或 Grid）
- 添加适当的动画和过渡效果
- 确保代码结构清晰

## 输出格式
请生成完整的 HTML 和 CSS 代码，确保页面专业、美观且独特。

特别注意：
- 不要使用固定的模板布局
- 根据内容特点设计不同的视觉风格
- 可以添加图标、装饰元素等增强视觉效果`;

    try {
      const result = await generateObject({
        model,
        schema: slideSchema,
        prompt,
        temperature: 0.8, // 增加创造性
      });

      return {
        html: result.object.html,
        css: result.object.css,
      };
    } catch (error) {
      // 如果 AI 生成失败，回退到简单模板
      console.warn('AI 生成页面失败，使用回退模板:', error);
      return this.generateSimpleFallback(params);
    }
  }

  private generateSimpleFallback(params: {
    title: string;
    bullets: string[];
    theme?: { primary?: string; background?: string; text?: string };
  }): { html: string; css: string } {
    const primary = params.theme?.primary ?? '#4285F4';
    const background = params.theme?.background ?? '#F8F9FA';
    const text = params.theme?.text ?? '#202124';

    const css = `
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        background: ${background};
        color: ${text};
      }
      .frame {
        width: 1280px;
        height: 720px;
        padding: 64px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .kicker {
        color: ${primary};
        font-weight: 600;
        letter-spacing: .08em;
        text-transform: uppercase;
        font-size: 14px;
      }
      h1 {
        margin: 14px 0 18px;
        font-size: 54px;
        line-height: 1.08;
      }
      ul {
        margin: 0;
        padding-left: 26px;
        font-size: 28px;
        line-height: 1.55;
      }
      li { margin: 8px 0; }
      .footer {
        position: absolute;
        left: 64px;
        bottom: 32px;
        font-size: 14px;
        opacity: 0.6;
      }
    `;

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${css}</style>
  </head>
  <body>
    <div class="frame">
      <div class="kicker">Rematrix</div>
      <h1>${this.escapeHtml(params.title)}</h1>
      <ul>${params.bullets.map((b) => `<li>${this.escapeHtml(b)}</li>`).join('')}</ul>
      <div class="footer">Generated by AI</div>
    </div>
  </body>
</html>`;

    return { html, css };
  }

  private escapeHtml(input: string): string {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async generateCustomLayout(params: {
    content: string;
    layoutType: 'title' | 'content' | 'split' | 'image-text';
    theme?: { primary?: string; background?: string; text?: string };
    context?: string;
  }): Promise<{ html: string; css: string }> {
    const model = this.openai('z-ai/glm-4.6');

    const layoutSchema = z.object({
      html: z.string().min(1),
      css: z.string().min(1),
      description: z.string().optional(),
    });

    const prompt = this.buildLayoutPrompt(params);

    try {
      const { object } = await generateObject({
        model,
        temperature: 0.8,
        schema: layoutSchema,
        prompt,
      });

      return {
        html: object.html,
        css: object.css,
      };
    } catch (error) {
      console.error('Failed to generate custom layout:', error);
      throw new BadRequestException('Failed to generate layout');
    }
  }

  private buildLayoutPrompt(params: {
    content: string;
    layoutType: 'title' | 'content' | 'split' | 'image-text';
    theme?: { primary?: string; background?: string; text?: string };
    context?: string;
  }): string {
    const { content, layoutType, theme, context } = params;

    let prompt = `你是一个专业的网页设计师，需要生成一个自定义布局的页面。

## 任务要求
生成一个完整的 HTML 页面，包含内联 CSS 样式，用于展示内容。

## 内容信息
- 内容：${content}
- 布局类型：${layoutType}

## 布局说明
- title: 标题页布局，大标题突出
- content: 内容页布局，正文为主
- split: 分栏布局，左右或上下分割
- image-text: 图文混排布局

## 设计要求
- 页面尺寸：1280x720 像素
- 设计风格：现代、专业、美观
- 布局：根据类型选择合适的布局结构
- 交互：静态展示，注重视觉效果`;

    if (theme) {
      prompt += `

## 主题色彩
- 主色：${theme.primary || '#4285F4'}
- 背景色：${theme.background || '#F8F9FA'}
- 文字色：${theme.text || '#202124'}`;
    }

    if (context) {
      prompt += `

## 上下文信息
${context}`;
    }

    prompt += `

## 输出格式
请返回 JSON 格式，包含以下字段：
- html: 完整的 HTML 代码（包含 doctype、html、head、body 标签）
- css: CSS 样式代码（可以内联在 HTML 中）
- description: 设计说明（可选）

请生成一个专业、美观的自定义布局页面。`;

    return prompt;
  }
}
