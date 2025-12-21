# Artifacts API

产物管理接口，负责查询和管理视频生成过程中产生的各种中间产物。

## 概述

Artifacts API 提供对视频生成过程中各个阶段产物的访问能力。每个 Artifact 代表特定阶段的输出内容，如计划、大纲、分镜、口播稿等。

## 基础信息

- **Base URL**: `http://localhost:3000`
- **Content-Type**: `application/json`
- **支持轮询**: 可等待特定阶段的产物生成完成

## 产物类型

| 阶段 | 产物类型 | 说明 |
|------|----------|------|
| PLAN | `plan` | 视频制作计划和整体安排 |
| OUTLINE | `outline` | 文档大纲和结构规划 |
| STORYBOARD | `storyboard` | 分镜头脚本和视觉设计 |
| NARRATION | `narration` | 口播稿和旁白内容 |
| PAGES | `pages` | 视觉页面设计和布局 |
| TTS | `tts` | 文字转语音音频文件 |
| RENDER | `render` | 渲染后的视频片段 |
| MERGE | `merge` | 最终合成的完整视频 |

---

## 接口详情

### 1. 获取任务产物列表

查询指定任务的所有产物，支持等待特定阶段的产物。

```http
GET /jobs/{jobId}/artifacts
```

**路径参数**:
- `jobId` (string): 任务 ID

**查询参数**:
- `waitForStage` (string, 可选): 等待特定阶段的产物
- `timeoutMs` (number, 可选): 等待超时时间（毫秒），默认 30000

**响应示例**:
```json
{
  "artifacts": [
    {
      "id": "artifact_123",
      "jobId": "job_456",
      "stage": "PLAN",
      "type": "plan",
      "content": {
        "title": "深度学习入门视频",
        "duration": "10-15分钟",
        "sections": [
          {
            "title": "基础概念",
            "estimatedTime": "3分钟"
          }
        ]
      },
      "blobUrl": "https://cdn.example.com/artifacts/plan_123.json",
      "createdAt": "2025-12-21T10:05:00Z",
      "updatedAt": "2025-12-21T10:05:00Z"
    },
    {
      "id": "artifact_124",
      "jobId": "job_456",
      "stage": "OUTLINE",
      "type": "outline",
      "content": {
        "sections": [
          {
            "title": "什么是深度学习",
            "points": ["定义", "历史", "应用领域"]
          }
        ]
      },
      "blobUrl": null,
      "createdAt": "2025-12-21T10:08:00Z",
      "updatedAt": "2025-12-21T10:08:00Z"
    }
  ],
  "totalCount": 2
}
```

---

### 2. 等待特定阶段产物

轮询等待指定阶段的产物生成完成。

```http
GET /jobs/{jobId}/artifacts?waitForStage={stage}&timeoutMs={timeout}
```

**示例请求**:
```bash
# 等待 NARRATION 阶段产物，最多等待 60 秒
GET /jobs/job_456/artifacts?waitForStage=NARRATION&timeoutMs=60000
```

**响应类型**:

**成功响应** (产物已生成):
```json
{
  "artifacts": [
    {
      "id": "artifact_125",
      "jobId": "job_456",
      "stage": "NARRATION",
      "type": "narration",
      "content": {
        "script": "大家好，今天我们来学习深度学习的基础知识...",
        "estimatedDuration": "12分钟"
      },
      "blobUrl": "https://cdn.example.com/artifacts/narration_125.json",
      "createdAt": "2025-12-21T10:15:00Z",
      "updatedAt": "2025-12-21T10:15:00Z"
    }
  ],
  "totalCount": 1,
  "waitStatus": "completed"
}
```

**超时响应** (产物未在指定时间内生成):
```json
{
  "artifacts": [],
  "totalCount": 0,
  "waitStatus": "timeout",
  "message": "等待 NARRATION 阶段产物超时"
}
```

---

## 代码逻辑详解

### ArtifactsService 核心逻辑

```typescript
// ArtifactsService.listByJob()
async listByJob(params: {
  jobId: string;
  waitForStage?: string;
  timeoutMs?: number;
}) {
  const { jobId, waitForStage, timeoutMs = 30000 } = params;
  
  // 1. 如果需要等待特定阶段
  if (waitForStage) {
    const artifact = await this.waitForStageArtifact(
      jobId, 
      waitForStage, 
      timeoutMs
    );
    
    if (artifact) {
      return {
        artifacts: [artifact],
        totalCount: 1,
        waitStatus: 'completed'
      };
    } else {
      return {
        artifacts: [],
        totalCount: 0,
        waitStatus: 'timeout',
        message: `等待 ${waitForStage} 阶段产物超时`
      };
    }
  }
  
  // 2. 直接查询所有产物
  const artifacts = await this.prisma.artifact.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' }
  });
  
  return {
    artifacts: artifacts.map(this.formatArtifact),
    totalCount: artifacts.length
  };
}
```

### 等待产物的实现机制

```typescript
// ArtifactsService.waitForStageArtifact()
private async waitForStageArtifact(
  jobId: string,
  stage: string,
  timeoutMs: number
): Promise<Artifact | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    // 1. 检查数据库中是否已有该阶段产物
    const artifact = await this.prisma.artifact.findFirst({
      where: { jobId, stage }
    });
    
    if (artifact) {
      return this.formatArtifact(artifact);
    }
    
    // 2. 检查任务是否失败或完成
    const job = await this.prisma.job.findUnique({
      where: { id: jobId }
    });
    
    if (job?.status === 'FAILED' || job?.status === 'COMPLETED') {
      return null;
    }
    
    // 3. 等待 500ms 后重试
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return null; // 超时
}
```

### 产物格式化逻辑

```typescript
// ArtifactsService.formatArtifact()
private formatArtifact(artifact: any) {
  // 1. 解析内容（JSON 字符串转对象）
  let content = null;
  try {
    content = artifact.content ? JSON.parse(artifact.content) : null;
  } catch (error) {
    console.error('解析产物内容失败:', error);
  }
  
  // 2. 返回格式化的产物信息
  return {
    id: artifact.id,
    jobId: artifact.jobId,
    stage: artifact.stage,
    type: artifact.type,
    content,
    blobUrl: artifact.blobUrl, // 对象存储 URL（如果有）
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt
  };
}
```

---

## 产物存储策略

### 存储层次

1. **数据库存储** (PostgreSQL)
   - 产物元数据（ID、阶段、类型等）
   - 小型产物内容（JSON 格式，< 1MB）
   - 创建和更新时间

2. **对象存储** (Bunny Storage)
   - 大型文件（音频、视频）
   - 生成 `blobUrl` 供访问
   - 失败时降级到数据库存储

### 上传流程

```typescript
// Artifact 创建流程
async createArtifact(data: {
  jobId: string;
  stage: string;
  type: string;
  content: any;
}) {
  let blobUrl = null;
  let contentToStore = data.content;
  
  // 1. 尝试上传到对象存储
  if (this.shouldUploadToStorage(data.content)) {
    try {
      const uploadResult = await this.storage.upload({
        key: `artifacts/${data.jobId}/${data.stage}_${Date.now()}.json`,
        content: JSON.stringify(data.content, null, 2),
        contentType: 'application/json'
      });
      
      blobUrl = uploadResult.url;
      contentToStore = null; // 大文件不存数据库
    } catch (error) {
      console.warn('对象存储上传失败，使用数据库存储:', error);
      // 降级到数据库存储
    }
  }
  
  // 2. 保存到数据库
  const artifact = await this.prisma.artifact.create({
    data: {
      jobId: data.jobId,
      stage: data.stage,
      type: data.type,
      content: contentToStore ? JSON.stringify(contentToStore) : null,
      blobUrl
    }
  });
  
  return this.formatArtifact(artifact);
}
```

---

## 使用示例

### 前端轮询实现

```typescript
// 前端轮询等待产物
const waitForArtifact = async (jobId: string, stage: string) => {
  const maxRetries = 60; // 最多等待 5 分钟
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const response = await fetch(
        `/jobs/${jobId}/artifacts?waitForStage=${stage}&timeoutMs=5000`
      );
      
      const result = await response.json();
      
      if (result.waitStatus === 'completed') {
        console.log(`${stage} 产物已生成:`, result.artifacts[0]);
        return result.artifacts[0];
      }
      
      if (result.waitStatus === 'timeout') {
        console.log(`等待 ${stage} 产物超时，继续重试...`);
        retryCount++;
        continue;
      }
    } catch (error) {
      console.error('查询产物失败:', error);
      retryCount++;
    }
    
    // 等待 5 秒后重试
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error(`等待 ${stage} 产物失败，已超时`);
};

// 使用示例
try {
  const planArtifact = await waitForArtifact('job_123', 'PLAN');
  console.log('计划内容:', planArtifact.content);
  
  const narrationArtifact = await waitForArtifact('job_123', 'NARRATION');
  console.log('口播稿:', narrationArtifact.content);
} catch (error) {
  console.error('获取产物失败:', error);
}
```

### 批量获取所有产物

```typescript
const getAllArtifacts = async (jobId: string) => {
  const response = await fetch(`/jobs/${jobId}/artifacts`);
  const result = await response.json();
  
  // 按阶段分组产物
  const artifactsByStage = result.artifacts.reduce((acc, artifact) => {
    acc[artifact.stage] = artifact;
    return acc;
  }, {});
  
  return artifactsByStage;
};

// 使用示例
const artifacts = await getAllArtifacts('job_123');
console.log('所有产物:', artifacts);

// 访问特定阶段产物
if (artifacts.PLAN) {
  console.log('计划:', artifacts.PLAN.content);
}

if (artifacts.NARRATION) {
  console.log('口播稿:', artifacts.NARRATION.content);
}
```

---

## 错误处理

### 常见错误

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 404 | 任务不存在 | 检查 Job ID 是否正确 |
| 400 | 无效的阶段名称 | 使用正确的阶段名称 |
| 408 | 等待超时 | 增加超时时间或检查任务状态 |
| 500 | 服务器内部错误 | 检查日志和数据库连接 |

### 错误响应格式

```json
{
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "指定的任务不存在",
    "details": {
      "jobId": "job_invalid_id"
    }
  }
}
```

---

## 性能优化

### 缓存策略

1. **产物缓存**: 已生成的产物在内存中缓存 1 小时
2. **数据库查询优化**: 使用索引加速按 Job ID 查询
3. **分页支持**: 大量产物时支持分页获取

### 监控指标

- 产物生成成功率
- 平均等待时间
- 存储使用量
- API 响应时间

---

*相关文档*: [Jobs API](./jobs.md) | [Workflow Engine API](./workflow-engine.md) | [存储架构](../architecture/storage.md)
