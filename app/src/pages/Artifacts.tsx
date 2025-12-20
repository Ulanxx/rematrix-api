import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import type { Artifact, GetArtifactsResponse, Stage } from '@/api/types'
import AppShell from '@/components/AppShell'
import { Badge } from '@/components/ui/8bit/badge'
import { Button } from '@/components/ui/8bit/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/8bit/card'
import { Input } from '@/components/ui/8bit/input'
import { Separator } from '@/components/ui/8bit/separator'

function stageLabel(stage: Stage) {
  return String(stage)
}

export default function ArtifactsPage() {
  const { jobId } = useParams()
  const [waitForStage, setWaitForStage] = useState<Stage>('')
  const [timeoutMs, setTimeoutMs] = useState('20000')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeout, setTimeout] = useState(false)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])

  const jobIdSafe = jobId || ''

  const finalVideo = useMemo(() => {
    const videos = artifacts.filter(
      (a) => String(a.stage) === 'MERGE' && String(a.type) === 'VIDEO',
    )
    if (videos.length === 0) return null
    return videos.reduce((acc, cur) => (cur.version > acc.version ? cur : acc))
  }, [artifacts])

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (waitForStage) params.set('waitForStage', waitForStage)
    if (timeoutMs) params.set('timeoutMs', timeoutMs)
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [timeoutMs, waitForStage])

  async function load() {
    if (!jobIdSafe) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<GetArtifactsResponse>(
        `/jobs/${encodeURIComponent(jobIdSafe)}/artifacts${query}`,
      )
      setArtifacts(res.artifacts || [])
      setTimeout(Boolean(res.timeout))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIdSafe])

  return (
    <AppShell
      title="产物列表"
      subtitle={`jobId: ${jobIdSafe}`}
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link to={`/jobs/${encodeURIComponent(jobIdSafe)}/process`}>制作过程</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? '加载中...' : '刷新'}
          </Button>
        </>
      }
    >
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
            <video className="w-full rounded-md border border-slate-200" controls src={finalVideo.blobUrl} />
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>等待参数（可选）</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-sm text-slate-600">waitForStage</div>
            <Input
              value={String(waitForStage)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setWaitForStage(e.target.value)
              }
              placeholder="OUTLINE"
            />
          </div>
          <div className="space-y-1">
            <div className="text-sm text-slate-600">timeoutMs</div>
            <Input
              value={timeoutMs}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTimeoutMs(e.target.value)
              }
              placeholder="20000"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void load()} disabled={loading}>
              重新拉取
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <div className="text-sm text-slate-600">结果</div>
          {timeout ? <Badge variant="outline">timeout</Badge> : <Badge variant="secondary">ok</Badge>}
        </div>

        <div className="grid gap-4">
          {artifacts.length === 0 ? (
            <div className="rounded-md border border-slate-200 p-6 text-sm text-slate-500">暂无 artifacts</div>
          ) : (
            artifacts.map((a) => (
              <Card key={`${a.stage}-${a.type}-${a.version}`}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{stageLabel(a.stage)}</Badge>
                    <Badge variant="secondary">{a.type}</Badge>
                    <Badge variant="outline">v{a.version}</Badge>
                    {a.blobUrl ? <Badge variant="secondary">blobUrl</Badge> : <Badge variant="outline">no blobUrl</Badge>}
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 text-sm text-slate-600">
                      {a.blobUrl ? (
                        <a className="truncate underline" href={a.blobUrl} target="_blank" rel="noreferrer">
                          {a.blobUrl}
                        </a>
                      ) : (
                        <span>blobUrl 为空，将使用 DB content 预览</span>
                      )}
                    </div>
                    <Button asChild variant="outline">
                      <Link
                        to={`/jobs/${encodeURIComponent(jobIdSafe)}/artifacts/${encodeURIComponent(String(a.stage))}/${a.version}`}
                      >
                        预览
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  )
}
