import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import type { Artifact, GetArtifactsResponse, Job, Stage } from '@/api/types'
import AppShell from '@/components/AppShell'
import { Badge } from '@/components/ui/8bit/badge'
import { Button } from '@/components/ui/8bit/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/8bit/card'
import { Input } from '@/components/ui/8bit/input'
import { Separator } from '@/components/ui/8bit/separator'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
}

function getToken(): string | null {
  return localStorage.getItem('rematrix_jwt')
}

function statusLabel(job: Job): string {
  if (job.status === 'COMPLETED') return '已完成'
  if (job.status === 'RUNNING') return '生成中'
  if (job.status === 'WAITING_APPROVAL') return '等待确认'
  if (job.status === 'FAILED') return '失败'
  if (job.status === 'DRAFT') return '草稿'
  return String(job.status)
}

function stageLabel(stage: Stage): string {
  return String(stage)
}

export default function AppDetailPage() {
  const { jobId } = useParams()
  const jobIdSafe = jobId || ''

  const [job, setJob] = useState<Job | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

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

  useEffect(() => {
    void loadOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIdSafe])

  async function send() {
    if (!jobIdSafe) return
    const text = input.trim()
    if (!text) return

    setChatError(null)
    setChatLoading(true)

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
    }
    const assistantId = `a_${Date.now()}`

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ])
    setInput('')

    try {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const url = `${getBaseUrl()}/jobs/${encodeURIComponent(jobIdSafe)}/chat/sse?message=${encodeURIComponent(text)}`
      const headers = new Headers()
      const token = getToken()
      if (token) headers.set('authorization', `Bearer ${token}`)

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `${res.status} ${res.statusText}`)
      }

      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('stream not supported')
      }

      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      const applyDelta = (delta: string) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `${m.content}${delta}` }
              : m,
          ),
        )
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        while (true) {
          const idx = buffer.indexOf('\n\n')
          if (idx === -1) break
          const rawEvent = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)

          const lines = rawEvent.split('\n')
          let eventName = 'message'
          const dataLines: string[] = []

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice('event:'.length).trim()
              continue
            }
            if (line.startsWith('data:')) {
              dataLines.push(line.slice('data:'.length).trim())
            }
          }

          const dataText = dataLines.join('\n')
          if (!dataText) continue

          let payload: unknown = null
          try {
            payload = JSON.parse(dataText)
          } catch {
            payload = { raw: dataText }
          }

          if (eventName === 'message') {
            if (payload && typeof payload === 'object' && 'delta' in payload) {
              const delta = (payload as { delta?: unknown }).delta
              applyDelta(String(delta ?? ''))
            }
            continue
          }

          if (eventName === 'error') {
            const msg =
              payload && typeof payload === 'object' && 'message' in payload
                ? String((payload as { message?: unknown }).message)
                : 'chat error'
            throw new Error(msg)
          }

          if (eventName === 'done') {
            controller.abort()
            break
          }
        }
      }
    } catch (e) {
      setChatError(e instanceof Error ? e.message : String(e))
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <AppShell
      title="应用详情"
      subtitle={`jobId: ${jobIdSafe}`}
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link to={`/jobs/${encodeURIComponent(jobIdSafe)}/artifacts`}>产物列表</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadOnce()}
            disabled={loading}
          >
            {loading ? '加载中...' : '刷新'}
          </Button>
        </>
      }
    >
      {error && <div className="mb-4 text-sm text-rose-600">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr,420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>Process</span>
                {job && (
                  <span className="text-xs font-normal text-slate-500">
                    {statusLabel(job)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!job && <div className="text-sm text-slate-600">加载中...</div>}
              {job && (
                <div className="space-y-3">
                  <div className="text-sm text-slate-600">
                    当前阶段：{String(job.currentStage || '-')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(latestByStage.values()).map((a) => (
                      <Badge key={`${a.stage}_${a.version}`} variant="outline">
                        {stageLabel(a.stage)} v{a.version}
                      </Badge>
                    ))}
                    {latestByStage.size === 0 && (
                      <div className="text-sm text-slate-600">暂无产物</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
              <CardHeader>
                <CardTitle>物料与素材</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {artifacts.length === 0 && (
                  <div className="text-sm text-slate-600">暂无物料</div>
                )}
                {artifacts.length > 0 && (
                  <div className="space-y-2">
                    {Array.from(latestByStage.values()).map((a) => (
                      <div
                        key={`${a.stage}_${a.version}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900">
                            {stageLabel(a.stage)}
                          </div>
                          <div className="text-xs text-slate-600">
                            {String(a.type)} · v{a.version}
                          </div>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to={`/jobs/${encodeURIComponent(jobIdSafe)}/artifacts/${encodeURIComponent(String(a.stage))}/${a.version}`}
                          >
                            预览
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
        </div>

        <div className="space-y-4">
          <Card className="h-[70vh]">
              <CardHeader>
                <CardTitle>ChatBot</CardTitle>
              </CardHeader>
              <CardContent className="flex h-[calc(70vh-60px)] flex-col">
                <div className="flex-1 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="space-y-3">
                    {messages.length === 0 && (
                      <div className="text-sm text-slate-600">
                        输入问题开始对话。
                      </div>
                    )}
                    {messages.map((m) => (
                      <div key={m.id} className="space-y-1">
                        <div className="text-xs text-slate-500">
                          {m.role === 'user' ? '你' : '助手'}
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-slate-900">
                          {m.content || (m.role === 'assistant' ? '...' : '')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {chatError && (
                  <div className="mt-3 text-sm text-rose-600">{chatError}</div>
                )}

                <Separator className="my-3" />

                <div className="flex items-center gap-2">
                  <Input
                    value={input}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setInput(e.target.value)
                    }
                    placeholder="问点什么..."
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') void send()
                    }}
                    disabled={chatLoading}
                  />
                  <Button type="button" onClick={() => void send()} disabled={chatLoading}>
                    {chatLoading ? '发送中...' : '发送'}
                  </Button>
                </div>
              </CardContent>
            </Card>

          <div className="text-xs text-slate-500">
            SSE 接口：/jobs/:id/chat/sse（Bearer）
          </div>
        </div>
      </div>
    </AppShell>
  )
}
