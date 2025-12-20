import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { apiClient } from '@/api/client'
import AppShell from '@/components/AppShell'
import { Button } from '@/components/ui/8bit/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/8bit/card'
import { Input } from '@/components/ui/8bit/input'
import { Textarea } from '@/components/ui/8bit/textarea'

type CreateJobResponse = { jobId: string }

type RunJobResponse = {
  workflowId: string
  runId: string
}

export default function CourseCreatePage() {
  const navigate = useNavigate()

  const [markdown, setMarkdown] = useState('')
  const [filename, setFilename] = useState<string | null>(null)

  const [targetDurationSec, setTargetDurationSec] = useState('')
  const [style, setStyle] = useState('')
  const [language, setLanguage] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const canSubmit = useMemo(() => markdown.trim().length > 0, [markdown])

  async function onPickFile(file: File | null) {
    if (!file) return
    setError(null)
    setResult(null)

    if (!file.name.toLowerCase().endsWith('.md')) {
      setError('仅支持 .md 文件')
      return
    }

    const text = await file.text()
    setFilename(file.name)
    setMarkdown(text)
  }

  async function createAndRun() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const payload: {
        markdown: string
        targetDurationSec?: number
        style?: string
        language?: string
      } = {
        markdown,
      }

      const parsedDuration = Number(targetDurationSec)
      if (!Number.isNaN(parsedDuration) && targetDurationSec.trim().length > 0) {
        payload.targetDurationSec = parsedDuration
      }
      if (style.trim()) payload.style = style.trim()
      if (language.trim()) payload.language = language.trim()

      const created = await apiClient.post<CreateJobResponse>('/jobs', payload)
      await apiClient.post<RunJobResponse>(
        `/jobs/${encodeURIComponent(created.jobId)}/run`,
      )

      setResult(`jobId: ${created.jobId}`)
      navigate(`/jobs/${encodeURIComponent(created.jobId)}/process`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell title="创建课程" subtitle="上传 Markdown → 创建 Job → 启动生成流程">
      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>课程素材（Markdown）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept=".md,text/markdown"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
            <div className="text-xs text-slate-500">
              {filename ? `已选择：${filename}` : '未选择文件'}
            </div>
            <Textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="也可以直接粘贴 Markdown 内容"
              className="min-h-80"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>课程配置（MVP）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={targetDurationSec}
              onChange={(e) => setTargetDurationSec(e.target.value)}
              placeholder="targetDurationSec（例如 60）"
            />
            <Input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="style（例如 Google 风格）"
            />
            <Input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="language（例如 zh-CN）"
            />

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => void createAndRun()}
                disabled={loading || !canSubmit}
              >
                {loading ? '提交中...' : '创建并开始执行'}
              </Button>
              {result && <div className="text-sm text-slate-600">{result}</div>}
            </div>

            <div className="text-xs text-slate-500">
              提示：JWT token 仍沿用首页 localStorage（rematrix_jwt）。
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
