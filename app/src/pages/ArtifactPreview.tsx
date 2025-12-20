import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import type { ApproveStageResponse, Artifact, GetArtifactsResponse, Stage } from '@/api/types'
import AppShell from '@/components/AppShell'
import { Badge } from '@/components/ui/8bit/badge'
import { Button } from '@/components/ui/8bit/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/8bit/card'
import { Separator } from '@/components/ui/8bit/separator'

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function ArtifactPreviewPage() {
  const { jobId, stage, version } = useParams()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [artifact, setArtifact] = useState<Artifact | null>(null)

  const [contentSource, setContentSource] = useState<'db' | 'blob'>('db')
  const [blobLoading, setBlobLoading] = useState(false)
  const [blobError, setBlobError] = useState<string | null>(null)
  const [blobContent, setBlobContent] = useState<unknown>(null)
  const [blobObjectUrl, setBlobObjectUrl] = useState<string | null>(null)

  const [approveLoading, setApproveLoading] = useState(false)
  const [approveResult, setApproveResult] = useState<string | null>(null)

  const jobIdSafe = jobId || ''
  const stageSafe = (stage || '') as Stage
  const versionNum = Number(version || '1')

  const title = useMemo(() => `${stageSafe} v${versionNum}`, [stageSafe, versionNum])

  const isVideo = String(artifact?.type) === 'VIDEO'
  const isImage = String(artifact?.type) === 'IMAGE'

  async function load() {
    if (!jobIdSafe) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<GetArtifactsResponse>(
        `/jobs/${encodeURIComponent(jobIdSafe)}/artifacts`,
      )
      const found = (res.artifacts || []).find(
        (a) => String(a.stage) === String(stageSafe) && a.version === versionNum,
      )
      setArtifact(found || null)

      setBlobError(null)
      setBlobContent(null)
      if (blobObjectUrl) URL.revokeObjectURL(blobObjectUrl)
      setBlobObjectUrl(null)
      setContentSource('db')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadBlob() {
    if (!artifact?.blobUrl) return
    setBlobLoading(true)
    setBlobError(null)
    try {
      const res = await fetch(artifact.blobUrl)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

      if (String(artifact.type) === 'JSON') {
        const json = (await res.json()) as unknown
        setBlobContent(json)
      } else {
        const blob = await res.blob()
        const nextUrl = URL.createObjectURL(blob)
        if (blobObjectUrl) URL.revokeObjectURL(blobObjectUrl)
        setBlobObjectUrl(nextUrl)
      }

      setContentSource('blob')
    } catch (e) {
      setBlobError(e instanceof Error ? e.message : String(e))
    } finally {
      setBlobLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (blobObjectUrl) URL.revokeObjectURL(blobObjectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!jobIdSafe || !stageSafe || Number.isNaN(versionNum)) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIdSafe, stageSafe, versionNum])

  async function approve() {
    if (!jobIdSafe || !stageSafe) return
    setApproveLoading(true)
    setApproveResult(null)
    setError(null)
    try {
      const res = await apiClient.post<ApproveStageResponse>(
        `/jobs/${encodeURIComponent(jobIdSafe)}/approve`,
        { stage: stageSafe },
      )
      setApproveResult(JSON.stringify(res, null, 2))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApproveLoading(false)
    }
  }

  return (
    <AppShell
      title="产物预览"
      subtitle={title}
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link to={`/jobs/${encodeURIComponent(jobIdSafe)}/process`}>制作过程</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/jobs/${encodeURIComponent(jobIdSafe)}/artifacts`}>产物列表</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? '加载中...' : '刷新'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>预览</CardTitle>
          </CardHeader>
          <CardContent>
            {artifact ? (
              <>
                {isVideo && (artifact.blobUrl || blobObjectUrl) ? (
                  <video
                    className="w-full rounded-md border border-slate-200"
                    controls
                    src={
                      contentSource === 'blob'
                        ? blobObjectUrl || undefined
                        : artifact.blobUrl || undefined
                    }
                  />
                ) : isImage && (artifact.blobUrl || blobObjectUrl) ? (
                  <img
                    className="w-full rounded-md border border-slate-200"
                    alt={title}
                    src={
                      contentSource === 'blob'
                        ? blobObjectUrl || undefined
                        : artifact.blobUrl || undefined
                    }
                  />
                ) : (
                  <pre className="overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                    {safeJson(
                      contentSource === 'blob' ? blobContent : artifact.content,
                    )}
                  </pre>
                )}
              </>
            ) : (
              <div className="text-sm text-slate-500">
                {loading
                  ? '加载中...'
                  : '未找到该 artifact（可能版本不匹配或尚未生成）'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>元信息与操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {artifact ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{String(artifact.stage)}</Badge>
                <Badge variant="secondary">{artifact.type}</Badge>
                <Badge variant="outline">v{artifact.version}</Badge>
                {artifact.blobUrl ? (
                  <Badge variant="secondary">blobUrl</Badge>
                ) : (
                  <Badge variant="outline">no blobUrl</Badge>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">未加载</div>
            )}

            <div className="grid gap-2">
              <div className="text-sm font-medium text-slate-700">内容来源</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={contentSource === 'db' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setContentSource('db')}
                  disabled={!artifact}
                >
                  DB
                </Button>
                <Button
                  type="button"
                  variant={contentSource === 'blob' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => void loadBlob()}
                  disabled={!artifact?.blobUrl || blobLoading}
                >
                  {blobLoading ? '拉取中...' : 'blobUrl'}
                </Button>
              </div>
              {blobError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  blobUrl 拉取失败：{blobError}
                </div>
              )}
            </div>

            {artifact?.blobUrl && (
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-700">链接</div>
                <a className="truncate text-sm underline" href={artifact.blobUrl} target="_blank" rel="noreferrer">
                  {artifact.blobUrl}
                </a>
              </div>
            )}

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void approve()}
                disabled={approveLoading || !stageSafe}
              >
                {approveLoading ? '提交中...' : 'Approve 当前 stage'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void load()}
                disabled={loading}
              >
                刷新
              </Button>
            </div>

            {approveResult && (
              <pre className="overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                {approveResult}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
