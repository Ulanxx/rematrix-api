# Artifacts 能力规格

## ADDED Requirements

### Requirement: Artifact 存储
系统 SHALL 存储每个阶段的产物，支持结构化数据（JSON）和大文件（音频/视频）。

#### Scenario: 存储结构化产物
- **WHEN** 阶段完成生成大纲/分镜/口播稿等结构化数据
- **THEN** 系统将数据存储为 Artifact，记录 jobId、stage、type、version、content

#### Scenario: 存储大文件产物
- **WHEN** 阶段完成生成音频/视频等大文件
- **THEN** 系统将文件上传到对象存储，Artifact 记录 blobUrl

### Requirement: Artifact 版本管理
系统 SHALL 支持 Artifact 版本化，用户修改后生成新版本。

#### Scenario: 用户修改产物
- **WHEN** 用户编辑口播稿或分镜脚本
- **THEN** 系统创建新版本的 Artifact，version 递增，createdBy 标记为 user

#### Scenario: 获取最新版本
- **WHEN** 查询 Artifact 时指定 latest=true
- **THEN** 返回最新版本的产物

### Requirement: Artifact 类型
系统 SHALL 支持以下 Artifact 类型：json、markdown、audio、image、video、text。

#### Scenario: 按类型查询
- **WHEN** 查询指定 stage 和 type 的 Artifact
- **THEN** 返回匹配的产物列表

### Requirement: Artifact 来源追踪
系统 SHALL 记录 Artifact 的创建来源：system（系统生成）或 user（用户修改）。

#### Scenario: 区分系统生成与用户修改
- **WHEN** 查询 Artifact 历史
- **THEN** 可以区分哪些是系统生成、哪些是用户修改
