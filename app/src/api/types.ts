export type Stage = 'PLAN' | 'OUTLINE' | 'NARRATION' | 'PAGES' | 'DONE' | string

export type JobStatus =
  | 'DRAFT'
  | 'WAITING_APPROVAL'
  | 'RUNNING'
  | 'COMPLETED'
  | string

export interface Job {
  id: string
  status: JobStatus
  currentStage?: Stage | null
  config?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
  error?: string | null
}

export interface CreateJobRequest {
  content: string
  style?: string
  language?: string
}

export interface ListJobsResponse {
  jobs: Job[]
}

export interface Artifact {
  stage: Stage
  type: 'JSON' | string
  version: number
  content: unknown
  blobUrl: string | null
  meta?: Record<string, unknown> | null
  createdBy?: string | null
  createdAt?: string
}

export interface GetArtifactsResponse {
  artifacts: Artifact[]
  timeout: boolean
}

export interface ApproveStageRequest {
  stage: Stage
}

export interface ChatMessage {
  id: string
  jobId: string
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface ListChatMessagesResponse {
  messages: ChatMessage[]
}

export interface RejectStageRequest {
  stage: Stage
  reason?: string
}

export interface ApproveStageResponse {
  ok: boolean
  job?: Job
  approval?: {
    stage: Stage
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | string
    comment?: string | null
  }
}

export interface RejectStageResponse extends ApproveStageResponse {
  timeout?: boolean
}

export interface PromptStageConfig {
  id: string
  stage: Stage
  model: string
  temperature: number | null
  prompt: string
  tools: Record<string, unknown> | null
  schema: Record<string, unknown> | null
  meta: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface PromptStagesResponse {
  stages: Stage[]
}
