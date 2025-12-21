# Mermaid 图表使用指南

本指南介绍如何在 Rematrix Server 文档中使用 Mermaid 图表来可视化流程、架构和关系。

## 🎯 支持的图表类型

### 1. 流程图 (Flowchart)

```mermaid
graph TB
    A[开始] --> B{条件判断}
    B -->|是| C[执行操作]
    B -->|否| D[跳过操作]
    C --> E[结束]
    D --> E
```

### 2. 序列图 (Sequence Diagram)

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Temporal
    participant AI
    
    Client->>API: 创建任务
    API->>Temporal: 启动工作流
    Temporal->>AI: 生成内容
    AI-->>Temporal: 返回结果
    Temporal-->>API: 更新状态
    API-->>Client: 返回任务信息
```

### 3. 架构图 (Architecture Diagram)

```mermaid
graph TB
    subgraph "客户端层"
        A[Web Frontend]
        B[Mobile App]
    end
    
    subgraph "API 网关层"
        C[NestJS API Gateway]
    end
    
    subgraph "业务服务层"
        D[Jobs Service]
        E[Artifacts Service]
        F[Workflow Engine]
        G[Chat Service]
    end
    
    subgraph "工作流编排层"
        H[Temporal Server]
        I[Temporal Worker]
    end
    
    subgraph "数据存储层"
        J[PostgreSQL]
        K[Redis Cache]
        L[Object Storage]
    end
    
    A --> C
    B --> C
    C --> D
    C --> E
    C --> F
    C --> G
    
    D --> H
    E --> H
    F --> H
    
    H --> I
    I --> J
    I --> K
    I --> L
```

### 4. 状态图 (State Diagram)

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> RUNNING: 启动
    RUNNING --> PAUSED: 暂停
    RUNNING --> WAITING_APPROVAL: 需要审批
    PAUSED --> RUNNING: 恢复
    WAITING_APPROVAL --> RUNNING: 批准
    WAITING_APPROVAL --> FAILED: 拒绝
    RUNNING --> COMPLETED: 完成
    RUNNING --> FAILED: 失败
    FAILED --> [*]
    COMPLETED --> [*]
```

### 5. 类图 (Class Diagram)

```mermaid
classDiagram
    class JobsService {
        +createJob(config: CreateJobDto): Promise<JobResponse>
        +getJob(jobId: string): Promise<Job>
        +runJob(jobId: string): Promise<void>
        +pauseJob(jobId: string): Promise<void>
        +approveJob(jobId: string, approval: ApprovalDto): Promise<void>
    }
    
    class ArtifactsService {
        +getArtifacts(jobId: string): Promise<Artifact[]>
        +getArtifact(artifactId: string): Promise<Artifact>
        +downloadArtifact(artifactId: string): Promise<Buffer>
    }
    
    class WorkflowEngineService {
        +executeCommand(command: CommandDto): Promise<CommandResult>
        +getCommandHistory(jobId: string): Promise<Command[]>
        +parseCommand(input: string): ParsedCommand
    }
    
    JobsService --> ArtifactsService
    JobsService --> WorkflowEngineService
```

### 6. 甘特图 (Gantt Chart)

```mermaid
gantt
    title 视频生成项目时间线
    dateFormat  YYYY-MM-DD
    section 准备阶段
    需求分析     :a1, 2024-01-01, 3d
    技术设计     :a2, after a1, 2d
    section 开发阶段
    API 开发     :b1, 2024-01-06, 5d
    工作流开发   :b2, after b1, 4d
    前端开发     :b3, after b1, 6d
    section 测试阶段
    单元测试     :c1, after b2, 3d
    集成测试     :c2, after b3, 2d
    部署准备     :c3, after c2, 2d
```

## 🎨 图表样式定制

### 主题配置

Mermaid 支持多种主题：

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffecb3', 'primaryTextColor': '#1b5e20', 'primaryBorderColor': '#ffecb3', 'lineColor': '#ffecb3', 'sectionBkgColor': '#f1f8e9', 'altSectionBkgColor': '#f1f8e9', 'gridColor': '#c5e1a5'}}}%%
graph TB
    A[开始] --> B[处理]
    B --> C[结束]
```

### 节点样式

```mermaid
graph LR
    A[默认节点]
    B["带文本的节点"]
    C{条件节点}
    D((圆形节点))
    E>不对称节点]
    F{菱形节点}
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
```

### 连接线样式

```mermaid
graph TB
    A --> B[实线箭头]
    A -.-> C[虚线箭头]
    A ==> D[粗实线箭头]
    A -- 描述文字 --> E[带文字的箭头]
    A -. 描述文字 .-> F[带文字的虚线箭头]
```

## 📝 最佳实践

### 1. 保持简洁
- 避免过于复杂的图表
- 合理分组和分层
- 使用清晰的命名

### 2. 一致性
- 统一的颜色方案
- 一致的节点形状
- 标准化的布局方向

### 3. 可读性
- 适当的字体大小
- 合理的间距
- 必要的注释说明

### 4. 维护性
- 模块化设计
- 易于修改的结构
- 清晰的代码格式

## 🔧 在文档中使用

### Markdown 语法

```markdown
```mermaid
graph TB
    A[开始] --> B[处理]
    B --> C[结束]
```
```

### 注意事项

1. **代码块标记**: 使用 `mermaid` 作为语言标识
2. **缩进**: 保持代码块内的正确缩进
3. **语法**: 遵循 Mermaid 语法规范
4. **兼容性**: 确保图表在不同主题下都能正常显示

## 🎯 实际应用示例

### API 调用流程

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant API as API 服务
    participant Temporal as Temporal
    participant AI as AI 服务
    
    Client->>API: POST /jobs
    API->>API: 验证请求
    API->>Temporal: 启动工作流
    Temporal->>AI: 调用 AI 生成
    AI-->>Temporal: 返回结果
    Temporal-->>API: 更新任务状态
    API-->>Client: 返回任务信息
```

### 系统架构图

```mermaid
graph TB
    subgraph "用户层"
        U[用户]
    end
    
    subgraph "应用层"
        W[Web 应用]
        M[移动应用]
    end
    
    subgraph "服务层"
        A[API 网关]
        J[任务服务]
        Wf[工作流服务]
    end
    
    subgraph "数据层"
        DB[(数据库)]
        S[对象存储]
    end
    
    U --> W
    U --> M
    W --> A
    M --> A
    A --> J
    A --> Wf
    J --> DB
    Wf --> DB
    J --> S
```

---

📖 **更多资源**: 
- [Mermaid 官方文档](https://mermaid.js.org/)
- [图表语法参考](https://mermaid.js.org/intro/n00b-syntaxReference.html)
- [主题配置指南](https://mermaid.js.org/config/theming.html)
