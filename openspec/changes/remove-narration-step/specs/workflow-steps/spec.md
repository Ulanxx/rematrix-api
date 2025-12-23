## REMOVED Requirements
### Requirement: NARRATION Step Generation
**Reason**: 用户当前只需要PDF输出，不需要语音生成功能，为简化工作流程而移除。
**Migration**: 工作流将直接从STORYBOARD进入PAGES阶段，NARRATION相关的代码和配置将被完全移除。

#### Scenario: Narration generation from storyboard and markdown
- **WHEN** system has completed STORYBOARD stage
- **THEN** system would generate narration text for each page
- **AND** narration would be stored as artifact for TTS processing

### Requirement: TTS Step Processing
**Reason**: 语音合成功能与当前的PDF生成目标不符，移除以简化流程。
**Migration**: TTS相关的服务配置和依赖将被移除，工作流不再包含音频处理阶段。

#### Scenario: Text-to-speech conversion
- **WHEN** narration text is available
- **THEN** system would convert text to audio using TTS provider
- **AND** audio files would be stored for video composition

### Requirement: RENDER Step Processing
**Reason**: 视频渲染功能与当前的PDF生成目标不符，移除以简化流程。
**Migration**: RENDER相关的视频处理依赖和配置将被移除，工作流不再包含视频渲染阶段。

#### Scenario: Video rendering from pages and audio
- **WHEN** pages and audio are available
- **THEN** system would render video frames for each page
- **AND** combine with audio to create video segments

### Requirement: MERGE Step Processing
**Reason**: 视频合并功能与当前的PDF生成目标不符，移除以简化流程。
**Migration**: MERGE相关的视频合成依赖将被移除，工作流不再包含最终视频合成阶段。

#### Scenario: Final video merging
- **WHEN** video segments are available
- **THEN** system would merge all segments into final video
- **AND** add subtitles and final processing

## MODIFIED Requirements
### Requirement: Video Generation Workflow Stages
The system SHALL support a simplified workflow sequence: PLAN → OUTLINE → STORYBOARD → PAGES → DONE.

#### Scenario: Simplified workflow execution
- **WHEN** user submits markdown document for conversion
- **THEN** system executes PLAN stage to generate video plan
- **AND** executes OUTLINE stage to create document structure
- **AND** executes STORYBOARD stage to generate visual planning
- **AND** executes PAGES stage to create final page content and PDF
- **AND** completes workflow without audio/video processing

### Requirement: PAGES Step Input Processing
The PAGES step SHALL accept input from STORYBOARD stage without requiring narration text and generate PDF output.

#### Scenario: Page and PDF generation from storyboard only
- **WHEN** STORYBOARD stage is completed
- **THEN** PAGES step shall process storyboard content directly
- **AND** generate page layouts and content based on storyboard visual descriptions
- **AND** produce PDF document as final output

### Requirement: Step Registration Management
The step registry SHALL exclude NARRATION, TTS, RENDER, and MERGE steps from available workflow stages.

#### Scenario: Step enumeration without audio/video steps
- **WHEN** system queries available workflow steps
- **THEN** registry shall return PLAN, OUTLINE, STORYBOARD, PAGES, DONE steps
- **AND** shall not include NARRATION, TTS, RENDER, or MERGE steps
