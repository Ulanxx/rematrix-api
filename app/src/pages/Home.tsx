import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/8bit/card'
import AppShell from '@/components/AppShell'

import { apiClient } from '@/api/client'
import type { Job, ListJobsResponse } from '@/api/types'

function statusLabel(job: Job): string {
  if (job.status === 'COMPLETED') return '已完成'
  if (job.status === 'RUNNING') return '生成中'
  if (job.status === 'WAITING_APPROVAL') return '等待确认'
  if (job.status === 'FAILED') return '失败'
  if (job.status === 'DRAFT') return '草稿'
  return String(job.status)
}

export default function HomePage() {
  const navigate = useNavigate()

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasJobs = useMemo(() => jobs.length > 0, [jobs])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ListJobsResponse>('/jobs')
      setJobs(res.jobs || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <AppShell
      title="首页"
      subtitle="应用列表"
    >
      <div className="space-y-4">
        {error && <div className="text-sm text-rose-600">{error}</div>}
        {!loading && !error && !hasJobs && (
          <div className="text-sm text-slate-600">暂无应用</div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              className="text-left"
              onClick={() => navigate(`/apps/${encodeURIComponent(job.id)}`)}
            >
              <Card className="transition hover:border-slate-300">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span className="truncate">{job.id}</span>
                      <span className="text-xs font-normal text-slate-500">
                        {statusLabel(job)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div>当前阶段：{String(job.currentStage || '-')}</div>
                  </CardContent>
                </Card>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
