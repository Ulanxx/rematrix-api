## Context
当前的视频生成工作流包含9个阶段：PLAN → OUTLINE → STORYBOARD → NARRATION → PAGES → TTS → RENDER → MERGE → DONE。为了简化流程并专注于文档到PDF的转换，需要移除语音相关的步骤（NARRATION和TTS），直接从分镜脚本生成页面。

## Goals / Non-Goals
- **Goals**: 
  - 简化工作流程，减少处理步骤
  - 直接从STORYBOARD生成PAGES，跳过语音生成
  - 保持PDF输出功能
  - 提高文档转换效率
- **Non-Goals**: 
  - 完全移除语音功能（未来可能重新添加）
  - 修改其他核心步骤（PLAN、OUTLINE、STORYBOARD）

## Decisions
- **Decision**: 移除NARRATION和TTS步骤
  - **Reason**: 用户当前只需要PDF输出，不需要语音功能
  - **Alternatives considered**: 
    - 保留步骤但设为可选（增加复杂度）
    - 创建独立的工作流（代码重复）
- **Decision**: 修改PAGES步骤直接依赖STORYBOARD
  - **Reason**: 分镜脚本已包含足够的页面信息
  - **Alternatives considered**: 
    - 创建新的中间步骤（不必要）
    - 让PAGES步骤同时处理NARRATION和STORYBOARD（复杂）

## Risks / Trade-offs
- **Risk**: 现有依赖NARRATION的代码可能出错
  - **Mitigation**: 全面检查和更新所有引用
- **Risk**: 工作流状态管理可能不一致
  - **Mitigation**: 更新所有工作流定义和状态转换
- **Trade-off**: 失去语音功能但获得简化流程
  - **Justification**: 符合当前用户需求，语音功能可以后续重新添加

## Migration Plan
1. **准备阶段**: 备份当前代码，创建feature分支
2. **移除阶段**: 删除NARRATION和TTS相关文件和引用
3. **修改阶段**: 更新PAGES步骤和工作流定义
4. **测试阶段**: 运行完整测试套件，验证新流程
5. **部署阶段**: 合并到主分支，部署到测试环境

## Open Questions
- PDF生成的具体格式要求是什么？
- 是否需要保留NARRATION步骤的数据库schema以备将来使用？
- 页面生成是否需要额外的样式或模板支持？
