import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiClient } from '@/api/client'
import type {
  PromptStageConfig,
  PromptStagesResponse,
  Stage,
} from '@/api/types'
import AppShell from '@/components/AppShell'
import { Badge } from '@/components/ui/8bit/badge'
import { Button } from '@/components/ui/8bit/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/8bit/card'
import { Input } from '@/components/ui/8bit/input'
import { Separator } from '@/components/ui/8bit/separator'
import { Textarea } from '@/components/ui/8bit/textarea'

type ListConfigsResponse = {
  configs: PromptStageConfig[]
}

type GetActiveResponse = {
  config: PromptStageConfig | null
}

type CreateConfigResponse = {
  config: PromptStageConfig
}

type UpdateConfigResponse = {
  config: PromptStageConfig
}

type DeleteConfigResponse = {
  config: PromptStageConfig
}

type PublishResponse = {
  active: {
    stage: Stage
    activeConfigId: string
    activeConfig: PromptStageConfig
    updatedAt: string
  }
}

type BootstrapResponse = {
  active: {
    stage: Stage
    activeConfigId: string
    activeConfig: PromptStageConfig
    updatedAt: string
  }
}

function formatTemperature(value: number | null) {
  if (value === null) return ''
  if (Number.isNaN(value)) return ''
  return String(value)
}

export default function PromptOpsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stages, setStages] = useState<Stage[]>([])
  const [selectedStage, setSelectedStage] = useState<Stage>('PLAN')

  const [configs, setConfigs] = useState<PromptStageConfig[]>([])
  const [activeConfig, setActiveConfig] = useState<PromptStageConfig | null>(
    null,
  )

  const [expandedPromptIds, setExpandedPromptIds] = useState<Set<string>>(
    () => new Set(),
  )

  const [editingId, setEditingId] = useState<string | null>(null)
  const [model, setModel] = useState('')
  const [temperature, setTemperature] = useState('')
  const [prompt, setPrompt] = useState('')
  const [toolsJson, setToolsJson] = useState('')
  const [schemaJson, setSchemaJson] = useState('')
  const [metaJson, setMetaJson] = useState('')
  const [dirty, setDirty] = useState(false)

  const canSave = useMemo(() => {
    return model.trim().length > 0 && prompt.trim().length > 0
  }, [model, prompt])

  const editingIsActive = useMemo(() => {
    if (!editingId) return false
    return Boolean(activeConfig && activeConfig.id === editingId)
  }, [activeConfig, editingId])

  function resetForm(next?: PromptStageConfig | null) {
    if (next) {
      setEditingId(next.id)
      setModel(next.model)
      setTemperature(formatTemperature(next.temperature))
      setPrompt(next.prompt)
      setToolsJson(next.tools ? JSON.stringify(next.tools, null, 2) : '')
      setSchemaJson(next.schema ? JSON.stringify(next.schema, null, 2) : '')
      setMetaJson(next.meta ? JSON.stringify(next.meta, null, 2) : '')
      setDirty(false)
      return
    }
    setEditingId(null)
    setModel('')
    setTemperature('')
    setPrompt('')
    setToolsJson('')
    setSchemaJson('')
    setMetaJson('')
    setDirty(false)
  }

  function parseOptionalJson(label: string, raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return undefined
    try {
      const value: unknown = JSON.parse(trimmed)
      if (value === null) return null
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label} 必须是 JSON object 或 null`)
      }
      return value as Record<string, unknown>
    } catch (e) {
      throw new Error(`${label} JSON 解析失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function copyActiveAsNew() {
    if (!activeConfig) return
    setEditingId(null)
    setModel(activeConfig.model)
    setTemperature(formatTemperature(activeConfig.temperature))
    setPrompt(activeConfig.prompt)
    setToolsJson(activeConfig.tools ? JSON.stringify(activeConfig.tools, null, 2) : '')
    setSchemaJson(activeConfig.schema ? JSON.stringify(activeConfig.schema, null, 2) : '')
    setMetaJson(activeConfig.meta ? JSON.stringify(activeConfig.meta, null, 2) : '')
  }

  function togglePrompt(id: string) {
    setExpandedPromptIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const loadStages = useCallback(async () => {
    const res = await apiClient.get<PromptStagesResponse>(
      '/admin/promptops/stages',
    )
    setStages(res.stages || [])
    if (res.stages?.length && !res.stages.includes(selectedStage)) {
      setSelectedStage(res.stages[0] as Stage)
    }
  }, [selectedStage])

  const loadStageData = useCallback(async (stage: Stage) => {
    const [configsRes, activeRes] = await Promise.all([
      apiClient.get<ListConfigsResponse>(
        `/admin/promptops/stages/${encodeURIComponent(String(stage))}/configs`,
      ),
      apiClient.get<GetActiveResponse>(
        `/admin/promptops/stages/${encodeURIComponent(String(stage))}/active`,
      ),
    ])

    setConfigs(configsRes.configs || [])
    setActiveConfig(activeRes.config || null)
  }, [])

  const reloadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await loadStages()
      await loadStageData(selectedStage)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [loadStageData, loadStages, selectedStage])

  useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  useEffect(() => {
    setLoading(true)
    setError(null)
    resetForm(null)
    void (async () => {
      try {
        await loadStageData(selectedStage)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [loadStageData, selectedStage])

  useEffect(() => {
    if (!activeConfig) return
    if (dirty) return
    if (editingId) return
    resetForm(activeConfig)
  }, [activeConfig, dirty, editingId])

  async function save() {
    if (!canSave) return

    setLoading(true)
    setError(null)
    try {
      const temp = temperature.trim() ? Number(temperature) : undefined
      if (temperature.trim() && Number.isNaN(temp)) {
        throw new Error('temperature 必须是数字')
      }

      const tools = parseOptionalJson('tools', toolsJson)
      const schema = parseOptionalJson('schema', schemaJson)
      const meta = parseOptionalJson('meta', metaJson)

      if (editingId) {
        await apiClient.patch<UpdateConfigResponse>(
          `/admin/promptops/configs/${encodeURIComponent(editingId)}`,
          {
            model: model.trim(),
            temperature: temp,
            prompt: prompt,
            tools,
            schema,
            meta,
          },
        )
      } else {
        await apiClient.post<CreateConfigResponse>('/admin/promptops/configs', {
          stage: selectedStage,
          model: model.trim(),
          temperature: temp,
          prompt: prompt,
          tools,
          schema,
          meta,
        })
      }

      resetForm(null)
      await loadStageData(selectedStage)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function publish(configId: string) {
    setLoading(true)
    setError(null)
    try {
      await apiClient.post<PublishResponse>(
        `/admin/promptops/stages/${encodeURIComponent(String(selectedStage))}/publish`,
        { configId },
      )
      await loadStageData(selectedStage)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function bootstrapStage() {
    setLoading(true)
    setError(null)
    try {
      await apiClient.post<BootstrapResponse>(
        `/admin/promptops/stages/${encodeURIComponent(String(selectedStage))}/bootstrap`,
      )
      setEditingId(null)
      setDirty(false)
      await loadStageData(selectedStage)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function removeConfig(configId: string) {
    setLoading(true)
    setError(null)
    try {
      await apiClient.delete<DeleteConfigResponse>(
        `/admin/promptops/configs/${encodeURIComponent(configId)}`,
      )
      if (editingId === configId) resetForm(null)
      await loadStageData(selectedStage)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell
      title="PromptOps"
      subtitle="可视化配置每个 stage 的 prompt / model / temperature，并发布 active 配置。"
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => activeConfig && resetForm(activeConfig)}
            disabled={loading || !activeConfig}
          >
            编辑 active
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyActiveAsNew()}
            disabled={loading || !activeConfig}
          >
            复制 active 为新版本
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reloadAll()}
            disabled={loading}
          >
            {loading ? '加载中...' : '刷新'}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Stages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {stages.length === 0 ? (
              <div className="text-sm text-slate-500">暂无 stage</div>
            ) : (
              stages.map((s) => {
                const active = String(s) === String(selectedStage)
                return (
                  <Button
                    key={String(s)}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => setSelectedStage(s)}
                    disabled={loading}
                  >
                    {String(s)}
                  </Button>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>配置列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{String(selectedStage)}</Badge>
              {activeConfig ? (
                <Badge variant="secondary">active: {activeConfig.id.slice(0, 8)}</Badge>
              ) : (
                <Badge variant="outline">no active</Badge>
              )}
            </div>

            {!activeConfig && configs.length === 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm text-amber-800">
                  当前 stage 还没有任何 Prompt 配置。你可以初始化一份默认配置并自动发布为 active，然后直接编辑。
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void bootstrapStage()}
                  disabled={loading}
                >
                  初始化默认配置
                </Button>
              </div>
            )}

            <Separator className="my-4" />

            <div className="grid gap-4">
              {configs.length === 0 ? (
                <div className="text-sm text-slate-500">暂无 configs</div>
              ) : (
                configs.map((c) => {
                  const isActive = Boolean(activeConfig && activeConfig.id === c.id)
                  const isExpanded = expandedPromptIds.has(c.id)
                  return (
                    <Card key={c.id}>
                      <CardContent className="pt-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={isActive ? 'secondary' : 'outline'}>
                              {isActive ? 'ACTIVE' : 'CONFIG'}
                            </Badge>
                            <Badge>{c.id.slice(0, 8)}</Badge>
                            <Badge variant="secondary">{c.model}</Badge>
                            {c.temperature === null ? (
                              <Badge variant="outline">temp: null</Badge>
                            ) : (
                              <Badge variant="outline">temp: {c.temperature}</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => resetForm(c)}
                              disabled={loading}
                            >
                              编辑
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => togglePrompt(c.id)}
                              disabled={loading}
                            >
                              {isExpanded ? '收起 Prompt' : '展开 Prompt'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void publish(c.id)}
                              disabled={loading || isActive}
                            >
                              发布
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void removeConfig(c.id)}
                              disabled={loading || isActive}
                            >
                              删除
                            </Button>
                          </div>
                        </div>

                        <Separator className="my-4" />

                        <div className="grid gap-2">
                          <div className="text-sm font-medium text-slate-700">prompt</div>
                          <div className="text-xs text-slate-500">
                            长度：{c.prompt?.length ?? 0}
                            {' '}· 点击“编辑”可直接修改该配置
                          </div>
                          <pre
                            className={`overflow-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100 whitespace-pre-wrap break-words ${
                              isExpanded ? 'max-h-96' : 'max-h-40'
                            }`}
                            onDoubleClick={() => resetForm(c)}
                          >
                            {c.prompt}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <span>{editingId ? '编辑配置' : '新建配置'}</span>
              {editingIsActive && <span className="ml-2 text-xs text-slate-500">(ACTIVE)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editingIsActive && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                你正在直接编辑当前 stage 的 active 配置。保存后将立即影响后续生成任务。
              </div>
            )}
            <div className="space-y-1">
              <div className="text-sm text-slate-600">stage</div>
              <Input value={String(selectedStage)} disabled />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-slate-600">model</div>
              <Input
                value={model}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setDirty(true)
                  setModel(e.target.value)
                }}
                placeholder="z-ai/glm-4.6v"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-slate-600">temperature（可选）</div>
              <Input
                value={temperature}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setDirty(true)
                  setTemperature(e.target.value)
                }}
                placeholder="0.6"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-slate-600">prompt</div>
              <Textarea
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setDirty(true)
                  setPrompt(e.target.value)
                }}
                placeholder="输入 prompt..."
                className="min-h-60"
                disabled={loading}
              />
            </div>

            <Separator className="my-2" />

            <div className="space-y-1">
              <div className="text-sm text-slate-600">tools（JSON，可选）</div>
              <Textarea
                value={toolsJson}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setDirty(true)
                  setToolsJson(e.target.value)
                }}
                placeholder='{"name": "tool"}'
                className="min-h-28 font-mono text-xs"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-slate-600">schema（JSON，可选）</div>
              <Textarea
                value={schemaJson}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setDirty(true)
                  setSchemaJson(e.target.value)
                }}
                placeholder='{"type": "object"}'
                className="min-h-28 font-mono text-xs"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-slate-600">meta（JSON，可选）</div>
              <Textarea
                value={metaJson}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setDirty(true)
                  setMetaJson(e.target.value)
                }}
                placeholder='{"note": "..."}'
                className="min-h-28 font-mono text-xs"
                disabled={loading}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void save()}
                disabled={loading || !canSave}
              >
                {editingId ? '保存' : '创建'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => resetForm(null)}
                disabled={loading}
              >
                清空
              </Button>
            </div>

            {editingId && (
              <div className="text-xs text-slate-500">id: {editingId}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
