# Storage 能力规格

## ADDED Requirements

### Requirement: 存储供应商抽象
系统 SHALL 提供 StorageProvider 接口，支持 Bunny Edge Storage。

#### Scenario: 切换存储供应商
- **WHEN** 配置 STORAGE_PROVIDER=bunny 且配置 Bunny Storage 连接参数
- **THEN** 系统使用 Bunny Edge Storage 存储文件

### Requirement: Bunny 连接配置
系统 SHALL 支持通过环境变量配置 Bunny Edge Storage。

#### Scenario: 配置 Bunny Storage Zone 与 Endpoint
- **WHEN** 配置 BUNNY_STORAGE_ZONE、BUNNY_STORAGE_HOSTNAME、BUNNY_STORAGE_ACCESS_KEY
- **THEN** StorageService 可通过 Bunny Edge Storage API 上传、下载与删除文件

### Requirement: 文件上传
系统 SHALL 支持上传文件到对象存储。

#### Scenario: 上传文件
- **WHEN** 调用 StorageService.upload 并传入文件内容和路径
- **THEN** 上传文件，返回公开访问 URL

#### Scenario: 上传大文件
- **WHEN** 文件大小超过 100MB
- **THEN** 使用分片上传

### Requirement: 文件下载
系统 SHALL 支持生成下载 URL。

#### Scenario: 生成下载链接
- **WHEN** 调用 StorageService.getSignedUrl 并指定过期时间
- **THEN** 返回可下载的临时 URL

### Requirement: 文件删除
系统 SHALL 支持删除存储的文件。

#### Scenario: 删除文件
- **WHEN** 调用 StorageService.delete 并传入文件路径
- **THEN** 从对象存储中删除文件

### Requirement: 文件过期策略
系统 SHALL 支持配置文件过期策略。

#### Scenario: 自动清理过期文件
- **WHEN** 配置 STORAGE_EXPIRY_DAYS
- **THEN** 超过指定天数的临时文件自动删除
