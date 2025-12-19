# Video 能力规格

## ADDED Requirements

### Requirement: 视频合成
系统 SHALL 支持将多个视频片段/图片合成为完整视频。

#### Scenario: 合成视频
- **WHEN** 调用 VideoService.merge 并传入片段列表和音频列表
- **THEN** 使用 FFmpeg 合成，返回视频 URL

### Requirement: 音视频对齐
系统 SHALL 支持将音频与视频片段对齐。

#### Scenario: 对齐音频
- **WHEN** 每个片段有对应的 TTS 音频
- **THEN** 视频片段时长与音频时长匹配

### Requirement: 字幕烧录
系统 SHALL 支持将字幕烧录到视频中。

#### Scenario: 烧录 SRT 字幕
- **WHEN** 提供 SRT 格式字幕文件
- **THEN** 使用 FFmpeg drawtext 将字幕烧录到视频

#### Scenario: 生成字幕文件
- **WHEN** 调用 VideoService.generateSubtitles
- **THEN** 根据口播稿和时长生成 SRT/VTT 格式字幕（sentence-level，逐句 start/end）

### Requirement: 视频导出
系统 SHALL 支持导出多种视频格式。

#### Scenario: 导出 MP4
- **WHEN** 指定输出格式为 mp4
- **THEN** 使用 H.264 编码导出 MP4 文件

### Requirement: 视频元数据
系统 SHALL 在视频中嵌入元数据。

#### Scenario: 嵌入元数据
- **WHEN** 合成视频时
- **THEN** 嵌入标题、创建时间、来源 Job ID 等元数据
