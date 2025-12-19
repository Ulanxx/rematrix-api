# TTS 能力规格

## ADDED Requirements

### Requirement: TTS 供应商抽象
系统 SHALL 提供 TtsProvider 接口，支持多个 TTS 供应商。

#### Scenario: 切换 TTS 供应商
- **WHEN** 配置不同的 TTS_PROVIDER 环境变量
- **THEN** 系统使用对应的供应商生成语音

### Requirement: 语音合成
系统 SHALL 支持将文本转换为语音音频。

#### Scenario: 合成语音
- **WHEN** 调用 TtsService.synthesize 并传入文本和选项
- **THEN** 返回音频 URL、时长（毫秒）

#### Scenario: 指定语音参数
- **WHEN** 指定 voice（音色）、speed（语速）、language（语言）
- **THEN** 使用指定参数生成语音

### Requirement: 句级时间戳
系统 SHALL 在 TTS 供应商支持时返回句级时间戳，用于字幕对齐。

#### Scenario: 获取句级时间戳
- **WHEN** TTS 供应商支持句级时间戳
- **THEN** 返回 sentenceTimestamps 数组，包含每句的开始/结束时间

### Requirement: 批量合成
系统 SHALL 支持批量合成多段文本。

#### Scenario: 批量生成
- **WHEN** 调用 TtsService.synthesizeBatch 并传入多段文本
- **THEN** 并行生成，返回所有音频结果
