import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'Rematrix Server',
    description:
      '基于 NestJS + Temporal 的「从 Markdown 生成视频」编排与任务系统技术文档',

    // 主题配置
    themeConfig: {
      nav: [
        { text: '首页', link: '/' },
        { text: 'API 接口', link: '/api/' },
        { text: '架构设计', link: '/architecture/' },
        { text: '开发指南', link: '/guide/' },
        { text: '快速开始', link: '/quick-start' },
      ],

      sidebar: {
        '/api/': [
          {
            text: 'API 接口',
            items: [
              { text: '概览', link: '/api/' },
              { text: 'Jobs API', link: '/api/jobs' },
              { text: 'Artifacts API', link: '/api/artifacts' },
              { text: 'Workflow Engine API', link: '/api/workflow-engine' },
              { text: 'Chat SSE API', link: '/api/chat-sse' },
            ],
          },
        ],
        '/architecture/': [
          {
            text: '架构设计',
            items: [
              { text: '概览', link: '/architecture/' },
              { text: 'NestJS 架构', link: '/architecture/nestjs' },
              { text: 'Temporal 工作流', link: '/architecture/temporal' },
            ],
          },
        ],
        '/guide/': [
          {
            text: '开发指南',
            items: [
              { text: '指南概览', link: '/guide/' },
              { text: '环境搭建', link: '/guide/setup' },
              { text: 'API 使用指南', link: '/guide/api-usage' },
              { text: '调试指南', link: '/guide/debugging' },
              { text: 'Mermaid 图表', link: '/guide/mermaid' },
              { text: '部署指南', link: '/deployment' },
              { text: '常见问题', link: '/guide/faq' },
            ],
          },
        ],
        '/': [
          {
            text: '快速开始',
            items: [{ text: '5分钟上手', link: '/quick-start' }],
          },
          {
            text: '项目信息',
            items: [{ text: '项目总结', link: '/summary' }],
          },
        ],
      },

      socialLinks: [
        { icon: 'github', link: 'https://github.com/your-org/rematrix-server' },
      ],

      footer: {
        message: '基于 MIT 许可发布',
        copyright: `Copyright © 2025 Rematrix Team`,
      },

      search: {
        provider: 'local',
      },

      editLink: {
        pattern:
          'https://github.com/your-org/rematrix-server/edit/main/docs/:path',
        text: '在 GitHub 上编辑此页面',
      },
    },

    // Markdown 配置
    markdown: {
      theme: {
        light: 'github-light',
        dark: 'github-dark',
      },
      lineNumbers: true,
    },

    // Vite 配置
    vite: {
      optimizeDeps: {
        include: [
          'dayjs',
          '@braintree/sanitize-url',
          'debug',
          'cytoscape',
          'cytoscape-cose-bilkent',
        ],
      },
      define: {
        __VUE_OPTIONS_API__: false,
      },
      server: {
        host: true,
        port: 5173,
      },
    },

    // 忽略死链接检查
    ignoreDeadLinks: true,
  }),
);
