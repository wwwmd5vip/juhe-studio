import { useProviderStore } from '@renderer/stores/providers'
import type { RendererAPI } from '@shared/types/ipc'
import { COMMON_PARAMETERS } from '@shared/types/provider'
import { getPresetById } from '@shared/utils/provider-presets'
import {
  AlertCircle,
  Box,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit,
  Globe,
  Image,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
  X,
  Zap
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'

const api = (window as unknown as { api: RendererAPI }).api

interface ProviderDetailProps {
  providerId: string
  isOnboarding?: boolean
}

function normalizeCapabilities(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch (error) {
      console.error('Failed to parse capabilities JSON:', error)
      return []
    }
  }
  return []
}

const CAPABILITY_FILTERS: {
  key: string
  labelKey: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}[] = [
  { key: 'all', labelKey: 'all', icon: Tag },
  { key: 'reasoning', labelKey: 'reasoning', icon: Brain },
  { key: 'vision', labelKey: 'vision', icon: Image },
  { key: 'websearch', labelKey: 'websearch', icon: Globe },
  { key: 'free', labelKey: 'free', icon: Sparkles },
  { key: 'embedding', labelKey: 'embedding', icon: Box },
  { key: 'function_calling', labelKey: 'functionCalling', icon: Wrench }
]

export function ProviderDetail({ providerId }: ProviderDetailProps) {
  const { t } = useTranslation()
  const {
    providers,
    testConnection,
    fetchModels,
    toggleProviderEnabled,
    toggleModelEnabled,
    addModel,
    deleteProvider,
    setEditingProvider,
    modelSearchQuery,
    setModelSearchQuery,
    modelCapabilityFilter,
    setModelCapabilityFilter
  } = useProviderStore()

  const provider = providers.find((p) => p.id === providerId)
  const preset = useMemo(
    () => (provider?.presetId ? getPresetById(provider.presetId) : undefined),
    [provider?.presetId]
  )

  const [testing, setTesting] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null)
  const [fetchResult, setFetchResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showParams, setShowParams] = useState(false)
  const [params, setParams] = useState<Record<string, number>>(() =>
    Object.fromEntries(COMMON_PARAMETERS.map((p) => [p.key, p.defaultValue as number]))
  )
  const [showAddModel, setShowAddModel] = useState(false)
  const [newModelId, setNewModelId] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [addingModel, setAddingModel] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    setTestResult(null)
    setFetchResult(null)
  }, [])

  const filteredModels = useMemo(() => {
    if (!provider) return []
    const query = modelSearchQuery.toLowerCase().trim()
    return provider.models.filter((m) => {
      const matchesQuery =
        !query || m.name.toLowerCase().includes(query) || (m.displayName?.toLowerCase().includes(query) ?? false)
      const caps = normalizeCapabilities(m.capabilities)
      const matchesCap = modelCapabilityFilter === 'all' || caps.includes(modelCapabilityFilter)
      return matchesQuery && matchesCap
    })
  }, [provider, modelSearchQuery, modelCapabilityFilter])

  const enabledModels = filteredModels.filter((m) => m.isEnabled)
  const disabledModels = filteredModels.filter((m) => !m.isEnabled)

  const capabilityCounts = useMemo(() => {
    if (!provider) return { all: 0 }
    const counts: Record<string, number> = { all: provider.models.length }
    for (const m of provider.models) {
      const caps = normalizeCapabilities(m.capabilities)
      for (const c of caps) {
        counts[c] = (counts[c] ?? 0) + 1
      }
    }
    return counts
  }, [provider])

  if (!provider) return null

  const displayedApiKey = provider.apiKey || t('providerSettings.notSet', { defaultValue: 'Not set' })

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(provider.id)
    setTestResult(result)
    setTesting(false)
  }

  const handleFetchModels = async () => {
    setFetching(true)
    setFetchResult(null)
    try {
      const result = await fetchModels(provider.id)
      setFetchResult({
        ok: !result.error,
        message: result.error
          ? result.error
          : t('providerSettings.fetchResult', {
              defaultValue: 'Fetched {{total}} models ({{added}} new, {{updated}} updated)',
              total: result.total,
              added: result.added,
              updated: result.updated
            })
      })
    } catch (err) {
      setFetchResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to fetch models'
      })
    }
    setFetching(false)
  }

  const handleAddModel = async () => {
    if (!newModelId.trim()) return
    setAddingModel(true)
    const result = await addModel(provider.id, newModelId.trim(), newModelName.trim() || undefined)
    setAddingModel(false)
    if (result) {
      setNewModelId('')
      setNewModelName('')
      setShowAddModel(false)
      setFetchResult({
        ok: true,
        message: t('providerSettings.modelAdded', {
          defaultValue: '模型 "{{name}}" 添加成功',
          name: result.displayName || result.name
        })
      })
    }
  }

  return (
    <div className='flex h-full min-h-0 flex-col overflow-hidden bg-[var(--juhe-void-2)]'>
      {/* Header */}
      <div className='flex items-center justify-between border-b border-[var(--juhe-border)] px-6 py-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div
            className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold'
            style={{
              backgroundColor: stringToColor(preset?.name ?? provider.name),
              color: '#fff'
            }}
          >
            {provider.name[0]?.toUpperCase() ?? '?'}
          </div>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <h1 className='truncate text-lg font-semibold text-[var(--juhe-text)]'>{provider.name}</h1>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${provider.isEnabled ? 'bg-green-500' : 'bg-gray-400'}`}
              />
            </div>
            <p className='text-xs text-[var(--juhe-text-3)]'>{preset?.description ?? provider.type}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <label className='relative inline-flex cursor-pointer items-center'>
            <input
              type='checkbox'
              checked={provider.isEnabled}
              onChange={() => toggleProviderEnabled(provider.id)}
              className='peer sr-only'
            />
            <div className='h-6 w-11 rounded-full bg-[var(--juhe-surface-2)] transition-colors peer-checked:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]' />
            <div className='absolute left-1 top-1 h-4 w-4 rounded-full bg-[var(--juhe-text)] transition-transform peer-checked:translate-x-5' />
          </label>
          <button
            type='button'
            onClick={() => setEditingProvider(provider)}
            className='rounded-lg p-2 text-[var(--juhe-text-3)] transition-colors hover:bg-[var(--juhe-surface-2)] hover:text-[var(--juhe-text)]'
            title={t('providerSettings.edit')}
          >
            <Edit size={16} />
          </button>
          <button
            type='button'
            onClick={() => setShowDeleteConfirm(true)}
            className='rounded-lg p-2 text-[var(--juhe-magenta)] transition-colors hover:bg-[var(--juhe-magenta)]/10'
            title={t('providerSettings.delete')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className='min-h-0 flex-1 overflow-y-auto px-6 py-5'>
        {/* Auth section */}
        <section className='mb-6 rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface)] p-4'>
          <h2 className='mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--juhe-text-3)]'>
            {t('providerSettings.authentication', { defaultValue: 'Authentication' })}
          </h2>
          <div className='grid gap-3 sm:grid-cols-2'>
            {preset?.authType === 'dualKey' ? (
              <>
                <div>
                  <div className='text-xs text-[var(--juhe-text-3)]'>
                    {t('providerSettings.accessKeyId', { defaultValue: 'Access Key ID' })}
                  </div>
                  <div className='flex items-center gap-2'>
                    <code className='rounded bg-[var(--juhe-surface-2)] px-2 py-1 text-xs break-all'>
                      {provider.accessKeyId || t('providerSettings.notSet', { defaultValue: 'Not set' })}
                    </code>
                    {provider.accessKeyId && (
                      <button
                        type='button'
                        onClick={async () => {
                          const keys = await api.provider.getKey(provider.id)
                          if (keys?.accessKeyId) await navigator.clipboard.writeText(keys.accessKeyId)
                        }}
                        className='text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] shrink-0'
                        title={t('common.copy')}
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <div className='text-xs text-[var(--juhe-text-3)]'>
                    {t('providerSettings.secretAccessKey', { defaultValue: 'Secret Access Key' })}
                  </div>
                  <div className='flex items-center gap-2'>
                    <code className='rounded bg-[var(--juhe-surface-2)] px-2 py-1 text-xs break-all'>
                      {provider.secretAccessKey || t('providerSettings.notSet', { defaultValue: 'Not set' })}
                    </code>
                    {provider.secretAccessKey && (
                      <button
                        type='button'
                        onClick={async () => {
                          const keys = await api.provider.getKey(provider.id)
                          if (keys?.secretAccessKey) await navigator.clipboard.writeText(keys.secretAccessKey)
                        }}
                        className='text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] shrink-0'
                        title={t('common.copy')}
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div className='text-xs text-[var(--juhe-text-3)]'>{t('providerSettings.apiKey')}</div>
                <div className='flex items-center gap-2'>
                  <code className='rounded bg-[var(--juhe-surface-2)] px-2 py-1 text-xs break-all'>
                    {displayedApiKey}
                  </code>
                  {provider.apiKey && (
                    <button
                      type='button'
                      onClick={async () => {
                        const keys = await api.provider.getKey(provider.id)
                        if (keys?.apiKey) await navigator.clipboard.writeText(keys.apiKey)
                      }}
                      className='text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] shrink-0'
                      title={t('common.copy')}
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}
            <div>
              <div className='text-xs text-[var(--juhe-text-3)]'>{t('providerSettings.baseUrl')}</div>
              <code className='rounded bg-[var(--juhe-surface-2)] px-2 py-1 text-xs'>{provider.baseUrl || '—'}</code>
            </div>
          </div>
          {provider.lastError && (
            <div className='mt-3 rounded-lg bg-[var(--juhe-magenta)]/10 p-2.5 text-xs text-[var(--juhe-magenta)]'>
              {provider.lastError}
            </div>
          )}
          <div className='mt-4 flex items-center gap-2'>
            <button
              type='button'
              onClick={handleTest}
              disabled={testing}
              className='flex items-center gap-1.5 rounded-lg bg-[var(--juhe-cyan)]/10 px-3 py-2 text-sm font-medium text-[var(--juhe-cyan)] transition-colors hover:bg-[var(--juhe-cyan)]/20 disabled:opacity-50'
            >
              {testing ? <Loader2 size={14} className='animate-spin' /> : <Zap size={14} />}
              {testing ? t('providerSettings.testing') : t('providerSettings.testConnection')}
            </button>
            <button
              type='button'
              onClick={handleFetchModels}
              disabled={fetching}
              className='flex items-center gap-1.5 rounded-lg border border-[var(--juhe-border)] px-3 py-2 text-sm font-medium text-[var(--juhe-text)] transition-colors hover:bg-[var(--juhe-surface-2)] disabled:opacity-50'
            >
              {fetching ? <Loader2 size={14} className='animate-spin' /> : <RefreshCw size={14} />}
              {fetching ? t('providerSettings.fetching') : t('providerSettings.fetchModels')}
            </button>
          </div>
          {testResult && (
            <div
              className={`mt-3 flex items-center gap-2 rounded-lg p-2.5 text-sm
                ${testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]'}`}
            >
              {testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
              {testResult.message}
              {testResult.latency ? ` (${testResult.latency}ms)` : null}
            </div>
          )}
          {fetchResult && (
            <div
              className={`mt-3 rounded-lg p-2.5 text-sm
                ${fetchResult.ok ? 'bg-[var(--juhe-surface-2)]/50 text-[var(--juhe-text)]' : 'bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]'}`}
            >
              {fetchResult.message}
            </div>
          )}
        </section>

        {/* Models section */}
        <section className='mb-6 rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface)] p-4'>
          <div className='mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <h2 className='text-sm font-semibold uppercase tracking-wide text-[var(--juhe-text-3)]'>
              {t('providerSettings.models')}{' '}
              <span className='ml-1 rounded-full bg-[var(--juhe-surface-2)] px-2 py-0.5 text-xs text-[var(--juhe-text)]'>
                {provider.models.length}
              </span>
            </h2>
            <div className='flex items-center gap-2'>
              {/* 添加模型按钮 */}
              <button
                type='button'
                onClick={() => setShowAddModel((v) => !v)}
                className='flex items-center gap-1 rounded-lg border border-[var(--juhe-border)] px-3 py-2 text-sm font-medium text-[var(--juhe-text)] transition-colors hover:bg-[var(--juhe-surface-2)]'
              >
                <Plus size={14} />
                {t('providerSettings.addModel', { defaultValue: '添加模型' })}
              </button>
              <div className='relative w-56'>
                <Search size={14} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--juhe-text-3)]' />
                <input
                  type='text'
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  placeholder={t('common.search')}
                  className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] py-1.5 pl-8 pr-7 text-sm text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                />
                {modelSearchQuery && (
                  <button
                    type='button'
                    onClick={() => setModelSearchQuery('')}
                    className='absolute right-2 top-1/2 -translate-y-1/2 text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 手动添加模型输入框 */}
          {showAddModel && (
            <div className='mb-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] p-3'>
              <div className='flex flex-col gap-2 sm:flex-row sm:items-end'>
                <div className='flex-1'>
                  <label htmlFor='provider-model-id' className='mb-1 block text-xs font-medium text-[var(--juhe-text-3)]'>
                    {t('providerSettings.modelId', { defaultValue: '模型 ID' })}
                  </label>
                  <input
                    id='provider-model-id'
                    type='text'
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                    placeholder={t('providerSettings.modelIdPlaceholder', {
                      defaultValue: '例如: gpt-4o, claude-3-5-sonnet...'
                    })}
                    className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-1.5 text-sm text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAddModel()
                      }
                    }}
                  />
                </div>
                <div className='flex-1'>
                  <label htmlFor='provider-model-name' className='mb-1 block text-xs font-medium text-[var(--juhe-text-3)]'>
                    {t('providerSettings.modelName', { defaultValue: '显示名称 (可选)' })}
                  </label>
                  <input
                    id='provider-model-name'
                    type='text'
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder={t('providerSettings.modelNamePlaceholder', { defaultValue: '留空则使用模型 ID' })}
                    className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-1.5 text-sm text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAddModel()
                      }
                    }}
                  />
                </div>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    onClick={() => {
                      setShowAddModel(false)
                      setNewModelId('')
                      setNewModelName('')
                    }}
                    className='rounded-lg border border-[var(--juhe-border)] px-3 py-1.5 text-sm text-[var(--juhe-text-3)] transition-colors hover:bg-[var(--juhe-surface-2)]'
                  >
                    {t('common.cancel', { defaultValue: '取消' })}
                  </button>
                  <button
                    type='button'
                    onClick={handleAddModel}
                    disabled={!newModelId.trim() || addingModel}
                    className='flex items-center gap-1 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] px-3 py-1.5 text-sm font-medium text-[var(--juhe-cyan)]-foreground transition-colors hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 disabled:opacity-50'
                  >
                    {addingModel ? <Loader2 size={14} className='animate-spin' /> : <Plus size={14} />}
                    {t('common.add', { defaultValue: '添加' })}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Capability chips */}
          <div className='mb-3 flex flex-wrap gap-1.5'>
            {CAPABILITY_FILTERS.map(({ key, labelKey, icon: Icon }) => {
              const count = capabilityCounts[key] ?? 0
              const active = modelCapabilityFilter === key
              if (key !== 'all' && count === 0) return null
              return (
                <button
                  key={key}
                  type='button'
                  onClick={() => setModelCapabilityFilter(key)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
                    ${active ? 'border-[var(--juhe-cyan)] bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground' : 'border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)]/50'}`}
                >
                  <Icon size={12} />
                  {t(`providerSettings.capabilities.${labelKey}`)}
                  <span className='opacity-80'>({count})</span>
                </button>
              )
            })}
          </div>

          {/* Model lists */}
          <div className='space-y-3'>
            {enabledModels.length > 0 && (
              <div>
                <h3 className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--juhe-text-3)]'>
                  {t('providerSettings.enabledModels')}
                </h3>
                <div className='space-y-1'>
                  {enabledModels.map((model) => (
                    <ModelRow key={model.id} model={model} onToggle={() => toggleModelEnabled(provider.id, model.id)} />
                  ))}
                </div>
              </div>
            )}
            {disabledModels.length > 0 && (
              <div>
                <h3 className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--juhe-text-3)]'>
                  {t('providerSettings.disabledModels')}
                </h3>
                <div className='space-y-1'>
                  {disabledModels.map((model) => (
                    <ModelRow key={model.id} model={model} onToggle={() => toggleModelEnabled(provider.id, model.id)} />
                  ))}
                </div>
              </div>
            )}
            {filteredModels.length === 0 && (
              <div className='py-6 text-center text-sm text-[var(--juhe-text-3)]'>{t('providerSettings.noModels')}</div>
            )}
          </div>
        </section>

        {/* Parameters section */}
        <section className='rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface)] p-4'>
          <button
            type='button'
            onClick={() => setShowParams((v) => !v)}
            className='flex w-full items-center justify-between text-left'
          >
            <h2 className='text-sm font-semibold uppercase tracking-wide text-[var(--juhe-text-3)]'>
              {t('providerSettings.defaultParams')}
            </h2>
            {showParams ? (
              <ChevronUp size={16} className='text-[var(--juhe-text-3)]' />
            ) : (
              <ChevronDown size={16} className='text-[var(--juhe-text-3)]' />
            )}
          </button>
          {showParams && (
            <div className='mt-4 space-y-5'>
              {COMMON_PARAMETERS.map((param) => (
                <div key={param.key}>
                  <div className='mb-1.5 flex items-center justify-between'>
                    <label htmlFor={`provider-param-${param.key}`} className='text-sm font-medium text-[var(--juhe-text)]'>{param.label}</label>
                    <span className='rounded bg-[var(--juhe-surface-2)] px-1.5 py-0.5 text-xs text-[var(--juhe-text-3)]'>
                      {params[param.key] ?? param.defaultValue}
                    </span>
                  </div>
                  {param.type === 'slider' && (
                    <input
                      id={`provider-param-${param.key}`}
                      type='range'
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={params[param.key] ?? (param.defaultValue as number)}
                      onChange={(e) => setParams((prev) => ({ ...prev, [param.key]: parseFloat(e.target.value) }))}
                      className='w-full accent-primary'
                    />
                  )}
                  {param.type === 'number' && (
                    <input
                      id={`provider-param-${param.key}`}
                      type='number'
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={params[param.key] ?? (param.defaultValue as number)}
                      onChange={(e) => setParams((prev) => ({ ...prev, [param.key]: parseFloat(e.target.value) }))}
                      className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-1.5 text-sm text-[var(--juhe-text)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                    />
                  )}
                  {param.description && <p className='mt-1 text-xs text-[var(--juhe-text-3)]'>{param.description}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        title={t('providerSettings.delete', { defaultValue: 'Delete Provider' }) as string}
        description={t('providerSettings.confirmDelete', { defaultValue: 'Delete this provider?' }) as string}
        confirmText={t('providerSettings.delete', { defaultValue: 'Delete' }) as string}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' }) as string}
        danger
        onConfirm={() => {
          deleteProvider(provider.id)
          setShowDeleteConfirm(false)
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

function ModelRow({
  model,
  onToggle
}: {
  model: { id: string; name: string; displayName: string | null; capabilities: string[] | null; isEnabled: boolean }
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const caps = normalizeCapabilities(model.capabilities)
  return (
    <div className='flex items-center justify-between rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-2 transition-colors hover:border-[var(--juhe-cyan)]/30'>
      <div className='flex min-w-0 flex-col'>
        <span className='truncate text-sm font-medium text-[var(--juhe-text)]'>{model.displayName || model.name}</span>
        <div className='flex flex-wrap gap-1'>
          {caps.map((cap) => (
            <CapabilityTag key={cap} capability={cap} />
          ))}
          {caps.length === 0 && (
            <span className='text-[10px] text-[var(--juhe-text-3)]'>
              {t('providerSettings.noCapabilities', { defaultValue: 'No capabilities' })}
            </span>
          )}
        </div>
      </div>
      <label className='relative ml-3 inline-flex cursor-pointer items-center'>
        <input type='checkbox' checked={model.isEnabled} onChange={onToggle} className='peer sr-only' />
        <div className='h-5 w-9 rounded-full bg-[var(--juhe-surface-2)] transition-colors peer-checked:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]' />
        <div className='absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--juhe-text)] transition-transform peer-checked:translate-x-4' />
      </label>
    </div>
  )
}

function CapabilityTag({ capability }: { capability: string }) {
  const { t } = useTranslation()
  const labelKey = capability.replace(/-/g, '_')
  const translated = t(`providerSettings.capabilities.${labelKey}`, {
    defaultValue: labelKey
  })
  return (
    <span className='inline-flex items-center rounded bg-[var(--juhe-surface-2)]/60 px-1.5 py-0.5 text-[10px] font-medium text-[var(--juhe-text)]'>
      {translated}
    </span>
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue} 70% 45%)`
}
