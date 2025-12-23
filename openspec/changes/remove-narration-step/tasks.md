## 1. 移除NARRATION步骤相关代码
- [ ] 1.1 删除 narration.step.ts 文件
- [ ] 1.2 从 step-registry.service.ts 中移除 NARRATION 步骤注册
- [ ] 1.3 从 step-definition.interface.ts 中移除 NARRATION 相关引用
- [ ] 1.4 更新 index.ts 中的导出

## 2. 移除TTS步骤相关代码
- [ ] 2.1 删除 tts.step.ts 文件
- [ ] 2.2 从 step-registry.service.ts 中移除 TTS 步骤注册
- [ ] 2.3 更新相关导入和引用

## 3. 移除RENDER步骤相关代码
- [ ] 3.1 删除 render.step.ts 文件
- [ ] 3.2 从 step-registry.service.ts 中移除 RENDER 步骤注册
- [ ] 3.3 更新相关导入和引用

## 4. 移除MERGE步骤相关代码
- [ ] 4.1 删除 merge.step.ts 文件
- [ ] 4.2 从 step-registry.service.ts 中移除 MERGE 步骤注册
- [ ] 4.3 更新相关导入和引用

## 5. 修改PAGES步骤
- [ ] 5.1 更新 pages.step.ts 输入schema，移除对narration的依赖
- [ ] 5.2 修改PAGES步骤逻辑，直接从storyboard生成页面内容
- [ ] 5.3 添加PDF生成功能作为PAGES步骤的最终输出
- [ ] 5.4 更新PAGES步骤的prompt模板

## 6. 更新工作流定义
- [ ] 6.1 修改 video-generation.workflow.ts，移除NARRATION、TTS、RENDER、MERGE阶段
- [ ] 6.2 更新工作流顺序：PLAN → OUTLINE → STORYBOARD → PAGES → DONE
- [ ] 6.3 修改 video-generation.activities.ts 中的阶段处理逻辑

## 7. 更新相关服务和测试
- [ ] 7.1 更新 jobs.service.ts 中的阶段处理逻辑
- [ ] 7.2 更新 step-executor.service.ts 中的prompt构建逻辑
- [ ] 7.3 修改相关测试文件，移除NARRATION、TTS、RENDER、MERGE相关测试
- [ ] 7.4 更新集成测试

## 8. 清理音频视频处理依赖
- [ ] 8.1 移除音频处理相关的依赖包
- [ ] 8.2 移除视频处理相关的依赖包
- [ ] 8.3 清理相关的配置文件

## 9. 验证和测试
- [ ] 9.1 运行构建确保没有编译错误
- [ ] 9.2 测试新的工作流程
- [ ] 9.3 验证PDF生成功能
