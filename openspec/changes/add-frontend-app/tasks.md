## 1. 前端工程初始化（React + Vite + Tailwind）
- [x] 1.1 在 `app/` 初始化 Vite React TypeScript 工程（React 19.2.0）
- [x] 1.2 配置 Tailwind CSS（含 PostCSS）并提供基础样式入口
- [x] 1.3 集成 `shadcn/ui`（基础组件、主题与样式约定）
- [x] 1.3 配置 ESLint/Prettier（与仓库约定一致）
- [x] 1.4 配置别名与路径（例如 `@/` 指向 `src/`）

## 2. 应用壳与路由
- [x] 2.1 添加基础 Layout（Header/Sidebar/Main）与全局样式
- [x] 2.2 添加路由（至少 2-3 个占位页面）并配置 404
- [x] 2.3 添加基础错误边界与空状态组件（最小实现）

## 3. API 访问层（最小可用）
- [x] 3.1 定义环境变量约定（例如 `VITE_API_BASE_URL`）
- [x] 3.2 实现基础 `apiClient`（fetch 封装、超时/错误处理、JSON 解析、JWT Authorization Header 注入）
- [x] 3.3 提供示例接口调用与类型（仅示例，不要求覆盖全部后端模块）

## 4. 产物预览/确认（最小可用）
- [x] 4.1 增加 Job 入口页（最小实现：输入 jobId 或从列表选择其一）
- [x] 4.2 增加 Job 产物列表页（调用 artifacts 列表接口，按 stage 展示）
- [x] 4.3 增加单个 artifact 预览页（JSON/Markdown/BlobUrl 等类型的最小预览）
- [x] 4.4 增加“确认/提交确认”交互（与后端 approval 接口对接，若后端暂缺则先做 UI + 预留调用）

## 4.5 PromptOps 配置（最小可用）
- [x] 4.5.1 增加 PromptOps 页面入口与路由（`/promptops`）
- [x] 4.5.2 支持 stage 选择、config 列表、创建/编辑/删除、发布 active
- [x] 4.5.3 支持 `tools/schema/meta` JSON 编辑与校验
- [x] 4.5.4 支持“一键复制 active 为新版本”

## 5. DX 与验证
- [ ] 5.1 增加 README（如何启动/构建/配置环境变量、JWT 配置方式）
- [x] 5.2 本地启动验证（dev server 可运行、Tailwind/shadcn 生效、路由可跳转）
