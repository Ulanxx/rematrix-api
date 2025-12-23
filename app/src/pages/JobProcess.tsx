import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import type {
  ApproveStageResponse,
  Artifact,
  GetArtifactsResponse,
  Job,
  RejectStageResponse,
  Stage,
} from '@/api/types'
import { useWebSocket } from '@/lib/hooks/useWebSocket'
import AppShell from '@/components/AppShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Separator } from '@/components/ui/Separator'
import { Textarea } from '@/components/ui/Textarea'

type RunJobResponse = {
  workflowId: string
  runId: string
}

function isConfirmStage(stage: Stage): stage is 'PLAN' | 'NARRATION' | 'PAGES' {
  return stage === 'PLAN' || stage === 'NARRATION' || stage === 'PAGES'
}

export default function JobProcessPage() {
  const { jobId } = useParams()

  const jobIdSafe = jobId || ''

  const [job, setJob] = useState<Job | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])

  const [pollMs, setPollMs] = useState('1500')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionResult, setActionResult] = useState<string | null>(null)

  // WebSocket 连接管理
  const {
    connectionStatus,
    reconnectAttempts,
  } = useWebSocket({
    jobId: jobIdSafe,
    onJobStatusUpdate: (data) => {
      // 更新 job 状态
      setJob(prev => prev ? { 
        ...prev, 
        status: data.status as any, 
        currentStage: data.currentStage as any, 
        completedStages: data.completedStages 
      } : null)
      
      // 重新加载 artifacts 以获取最新数据
      void loadOnce()
    },
    onStageCompleted: (data) => {
      console.log(`Stage ${data.stage} completed`, data)
      // 阶段完成时重新加载 artifacts
      void loadOnce()
    },
    onJobError: (data) => {
      setError(`Job error: ${data.error}`)
    },
    onConnectionChange: (connected) => {
      if (!connected) {
        setError('WebSocket connection lost, may affect real-time updates')
      } else {
        setError(null)
      }
    },
    onError: (error) => {
      // console.error('WebSocket error:', error)
    },
  })

  const currentStage = (job?.currentStage || '') as Stage
  const canConfirm =
    job?.status === 'WAITING_APPROVAL' && isConfirmStage(currentStage)

  const finalVideo = useMemo(() => {
    const videos = artifacts.filter(
      (a) => String(a.stage) === 'MERGE' && String(a.type) === 'VIDEO',
    )
    if (videos.length === 0) return null
    return videos.reduce((acc, cur) => (cur.version > acc.version ? cur : acc))
  }, [artifacts])

  const latestByStage = useMemo(() => {
    const map = new Map<string, Artifact>()
    for (const a of artifacts) {
      const key = String(a.stage)
      const existing = map.get(key)
      if (!existing || a.version > existing.version) map.set(key, a)
    }
    return map
  }, [artifacts])

  async function loadOnce() {
    if (!jobIdSafe) return
    setLoading(true)
    setError(null)

    try {
      const [jobRes, artifactsRes] = await Promise.all([
        apiClient.get<Job>(`/jobs/${encodeURIComponent(jobIdSafe)}`),
        apiClient.get<GetArtifactsResponse>(
          `/jobs/${encodeURIComponent(jobIdSafe)}/artifacts`,
        ),
      ])
      setJob(jobRes)
      setArtifacts(artifactsRes.artifacts || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function run() {
    if (!jobIdSafe) return
    setActionLoading(true)
    setActionResult(null)
    setError(null)

    try {
      const res = await apiClient.post<RunJobResponse>(
        `/jobs/${encodeURIComponent(jobIdSafe)}/run`,
      )
      setActionResult(JSON.stringify(res, null, 2))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  async function approve() {
    if (!jobIdSafe || !canConfirm) return
    setActionLoading(true)
    setActionResult(null)
    setError(null)

    try {
      const res = await apiClient.post<ApproveStageResponse>(
        `/jobs/${encodeURIComponent(jobIdSafe)}/approve`,
        { stage: currentStage },
      )
      setActionResult(JSON.stringify(res, null, 2))
      await loadOnce()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  async function reject() {
    if (!jobIdSafe || !canConfirm) return
    setActionLoading(true)
    setActionResult(null)
    setError(null)

    try {
      const res = await apiClient.post<RejectStageResponse>(
        `/jobs/${encodeURIComponent(jobIdSafe)}/reject`,
        { stage: currentStage, reason: reason.trim() || undefined },
      )
      setActionResult(JSON.stringify(res, null, 2))
      await loadOnce()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  // 初始加载 job 和 artifacts
  useEffect(() => {
    if (jobIdSafe) {
      void loadOnce()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIdSafe])

  return (
    <AppShell
      title="制作过程"
      subtitle={`jobId: ${jobIdSafe}`}
      actions={
        <>
          {/* WebSocket 连接状态指示器 */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500' :
              connectionStatus === 'error' ? 'bg-red-500' :
              'bg-gray-400'
            }`} />
            <span className="text-xs text-gray-600">
              {connectionStatus === 'connected' ? '实时连接' :
               connectionStatus === 'connecting' ? '连接中...' :
               connectionStatus === 'error' ? '连接错误' :
               '未连接'}
            </span>
            {reconnectAttempts > 0 && (
              <span className="text-xs text-orange-600">
                (重连 {reconnectAttempts})
              </span>
            )}
          </div>
          
          <Button asChild variant="outline" size="sm">
            <Link to={`/jobs/${encodeURIComponent(jobIdSafe)}/artifacts`}>产物列表</Link>
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {finalVideo?.blobUrl && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>最终视频</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>MERGE</Badge>
              <Badge variant="secondary">VIDEO</Badge>
              <Badge variant="outline">v{finalVideo.version}</Badge>
            </div>

            <video
              className="w-full rounded-md border border-slate-200"
              controls
              src={finalVideo.blobUrl}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link
                  to={`/jobs/${encodeURIComponent(jobIdSafe)}/artifacts/${encodeURIComponent('MERGE')}/${finalVideo.version}`}
                >
                  打开预览
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={finalVideo.blobUrl} target="_blank" rel="noreferrer">
                  下载 / 打开
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{job?.status || 'unknown'}</Badge>
              <Badge variant="secondary">{String(currentStage || 'unknown')}</Badge>
              {canConfirm ? <Badge variant="outline">待确认</Badge> : <Badge variant="secondary">进行中</Badge>}
              {loading ? <Badge variant="outline">loading</Badge> : <Badge variant="secondary">ok</Badge>}
            </div>

            <Separator className="my-2" />

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <div className="text-sm text-slate-600">轮询间隔（ms）</div>
                <Input value={pollMs} onChange={(e) => setPollMs(e.target.value)} placeholder="1500" />
              </div>

              <div className="flex items-end gap-2">
                <Button type="button" onClick={() => void loadOnce()} disabled={loading}>
                  刷新
                </Button>
                <Button type="button" variant="outline" onClick={() => void run()} disabled={actionLoading}>
                  {actionLoading ? '提交中...' : 'Run'}
                </Button>
              </div>
            </div>

            <Separator className="my-2" />

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>待确认面板</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-slate-600">
                    当前阶段：{String(currentStage || '-')}
                  </div>
                  <Textarea
                    value={reason}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setReason(e.target.value)
                    }
                    placeholder="reject reason（可选）"
                    className="min-h-20"
                    disabled={!canConfirm}
                  />
                  <div className="flex items-center gap-2">
                    <Button type="button" onClick={() => void approve()} disabled={!canConfirm || actionLoading}>
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void reject()}
                      disabled={!canConfirm || actionLoading}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>当前阶段产物（latest）</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {currentStage && latestByStage.get(String(currentStage)) ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{String(latestByStage.get(String(currentStage))?.stage)}</Badge>
                        <Badge variant="secondary">{latestByStage.get(String(currentStage))?.type}</Badge>
                        <Badge variant="outline">v{latestByStage.get(String(currentStage))?.version}</Badge>
                      </div>
                      <Button asChild variant="outline">
                        <Link
                          to={`/jobs/${encodeURIComponent(jobIdSafe)}/artifacts/${encodeURIComponent(String(currentStage))}/${latestByStage.get(String(currentStage))?.version || 1}`}
                        >
                          打开预览
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">暂无</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {actionResult && (
              <pre className="mt-3 overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                {actionResult}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>产物列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {artifacts.length === 0 ? (
                <div className="text-sm text-slate-500">暂无 artifacts</div>
              ) : (
                artifacts.map((a) => (
                  <div
                    key={`${a.stage}-${a.type}-${a.version}`}
                    className="rounded-md border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{String(a.stage)}</Badge>
                      <Badge variant="secondary">{a.type}</Badge>
                      <Badge variant="outline">v{a.version}</Badge>
                    </div>
                    <div className="mt-2">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to={`/jobs/${encodeURIComponent(jobIdSafe)}/artifacts/${encodeURIComponent(String(a.stage))}/${a.version}`}
                        >
                          预览
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
