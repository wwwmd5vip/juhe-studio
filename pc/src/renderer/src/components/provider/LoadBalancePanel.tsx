import { type ProviderGroup, useLoadBalanceStore } from '@renderer/stores/loadbalance'
import { useProviderStore } from '@renderer/stores/providers'
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  X
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'

type Strategy = ProviderGroup['strategy']

const STRATEGIES: { key: Strategy; descKey: string }[] = [
  { key: 'round-robin', descKey: 'roundRobinDesc' },
  { key: 'random', descKey: 'randomDesc' },
  { key: 'priority', descKey: 'priorityDesc' },
  { key: 'latency', descKey: 'latencyDesc' }
]

export function LoadBalancePanel() {
  const { t } = useTranslation()
  const { providers } = useProviderStore()
  const { groups, health, createGroup, updateGroup, deleteGroup, runHealthCheck } = useLoadBalanceStore()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([])
  const [strategy, setStrategy] = useState<Strategy>('round-robin')
  const [isEnabled, setIsEnabled] = useState(true)
  const [healthCheckInterval, setHealthCheckInterval] = useState(30)
  const [maxRetries, setMaxRetries] = useState(3)
  const [timeout, setTimeout] = useState(30000)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setName('')
    setSelectedProviderIds([])
    setStrategy('round-robin')
    setIsEnabled(true)
    setHealthCheckInterval(30)
    setMaxRetries(3)
    setTimeout(30000)
    setEditingId(null)
  }, [])

  const startCreate = useCallback(() => {
    resetForm()
    setShowForm(true)
  }, [resetForm])

  const startEdit = useCallback((group: ProviderGroup) => {
    setEditingId(group.id)
    setName(group.name)
    setSelectedProviderIds([...group.providerIds])
    setStrategy(group.strategy)
    setIsEnabled(group.isEnabled)
    setHealthCheckInterval(group.healthCheckInterval)
    setMaxRetries(group.maxRetries)
    setTimeout(group.timeout)
    setShowForm(true)
  }, [])

  const cancelForm = useCallback(() => {
    setShowForm(false)
    resetForm()
  }, [resetForm])

  const submitForm = useCallback(() => {
    if (!name.trim() || selectedProviderIds.length === 0) return
    const data = {
      name: name.trim(),
      providerIds: selectedProviderIds,
      strategy,
      isEnabled,
      healthCheckInterval,
      maxRetries,
      timeout
    }
    if (editingId) {
      updateGroup(editingId, data)
    } else {
      createGroup(data)
    }
    setShowForm(false)
    resetForm()
  }, [
    name,
    selectedProviderIds,
    strategy,
    isEnabled,
    healthCheckInterval,
    maxRetries,
    timeout,
    editingId,
    createGroup,
    updateGroup,
    resetForm
  ])

  const toggleProviderSelection = useCallback((pid: string) => {
    setSelectedProviderIds((prev) => (prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setDeleteTargetId(id)
  }, [])

  const handleHealthCheck = useCallback(async () => {
    setChecking(true)
    await runHealthCheck()
    setChecking(false)
  }, [runHealthCheck])

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'healthy':
        return <ShieldCheck className='w-4 h-4 text-green-500' />
      case 'degraded':
        return <ShieldAlert className='w-4 h-4 text-yellow-500' />
      case 'unhealthy':
        return <ShieldOff className='w-4 h-4 text-red-500' />
      default:
        return <Activity className='w-4 h-4 text-[var(--juhe-text-3)]' />
    }
  }, [])

  const getStatusDot = useCallback((status: string) => {
    switch (status) {
      case 'healthy':
        return <span className='w-2 h-2 rounded-full bg-green-500 shrink-0' />
      case 'degraded':
        return <span className='w-2 h-2 rounded-full bg-yellow-500 shrink-0' />
      case 'unhealthy':
        return <span className='w-2 h-2 rounded-full bg-red-500 shrink-0' />
      default:
        return <span className='w-2 h-2 rounded-full bg-gray-400 shrink-0' />
    }
  }, [])

  const enabledProviders = useMemo(() => providers.filter((p) => p.isEnabled), [providers])

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>{t('loadBalance.title')}</h2>
          <p className='text-sm text-[var(--juhe-text-3)]'>{t('loadBalance.groupHint')}</p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={handleHealthCheck}
            disabled={checking || groups.length === 0}
            className='flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--juhe-surface-2)] text-[var(--juhe-text)]
                       text-sm font-medium hover:bg-[var(--juhe-surface-2)]/80 disabled:opacity-50 transition-colors'
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {t('loadBalance.healthCheck')}
          </button>
          <button
            type='button'
            onClick={startCreate}
            className='flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground
                       text-sm font-medium hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
          >
            <Plus className='w-4 h-4' />
            {t('loadBalance.createGroup')}
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold'>{editingId ? t('common.edit') : t('loadBalance.createGroup')}</h3>
            <button
              type='button'
              onClick={cancelForm}
              className='p-1 rounded-md hover:bg-[var(--juhe-surface-2)] transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <label htmlFor='lb-group-name' className='text-sm font-medium'>{t('loadBalance.groupName')}</label>
              <input
                id='lb-group-name'
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('loadBalance.groupName') as string}
                className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                           focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]'
              />
            </div>

            <div className='space-y-1.5'>
              <label htmlFor='lb-strategy' className='text-sm font-medium'>{t('loadBalance.strategy')}</label>
              <select
                id='lb-strategy'
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as Strategy)}
                className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                           focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]'
              >
                {STRATEGIES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {t(`loadBalance.strategies.${s.key}`)}
                  </option>
                ))}
              </select>
              <p className='text-xs text-[var(--juhe-text-3)]'>
                {t(`loadBalance.${STRATEGIES.find((s) => s.key === strategy)?.descKey || 'roundRobinDesc'}`)}
              </p>
            </div>
          </div>

          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>{t('loadBalance.selectProviders')}</label>
            {enabledProviders.length === 0 ? (
              <p className='text-sm text-[var(--juhe-text-3)]'>{t('loadBalance.noProviders')}</p>
            ) : (
              <div className='flex flex-wrap gap-2'>
                {enabledProviders.map((p) => {
                  const selected = selectedProviderIds.includes(p.id)
                  return (
                    <button
                      type='button'
                      key={p.id}
                      onClick={() => toggleProviderSelection(p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors
                        ${
                          selected
                            ? 'border-[var(--juhe-cyan)] bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                            : 'border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-[var(--juhe-text-3)] hover:bg-[var(--juhe-surface-2)]'
                        }`}
                    >
                      {selected ? <Check className='w-3.5 h-3.5' /> : <Server className='w-3.5 h-3.5' />}
                      {p.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='space-y-1.5'>
              <label htmlFor='lb-interval' className='text-sm font-medium'>{t('loadBalance.interval')}</label>
              <div className='flex items-center gap-2'>
                <input
                  id='lb-interval'
                  type='number'
                  min={5}
                  max={3600}
                  value={healthCheckInterval}
                  onChange={(e) => setHealthCheckInterval(Number(e.target.value))}
                  className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                             focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]'
                />
                <span className='text-xs text-[var(--juhe-text-3)] whitespace-nowrap'>s</span>
              </div>
            </div>
            <div className='space-y-1.5'>
              <label htmlFor='lb-max-retries' className='text-sm font-medium'>{t('loadBalance.maxRetries')}</label>
              <input
                id='lb-max-retries'
                type='number'
                min={1}
                max={10}
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                           focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]'
              />
            </div>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>{t('loadBalance.timeout')}</label>
              <div className='flex items-center gap-2'>
                <input
                  type='number'
                  min={1000}
                  max={300000}
                  step={1000}
                  value={timeout}
                  onChange={(e) => setTimeout(Number(e.target.value))}
                  className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                             focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]'
                />
                <span className='text-xs text-[var(--juhe-text-3)] whitespace-nowrap'>ms</span>
              </div>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            {/** biome-ignore lint/correctness/useUniqueElementIds: ignored using `--suppress` */}
            <input
              id='lb-enabled'
              type='checkbox'
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className='w-4 h-4 rounded border-[var(--juhe-border)]'
            />
            <label htmlFor='lb-enabled' className='text-sm font-medium'>
              {t('loadBalance.enabled')}
            </label>
          </div>

          <div className='flex justify-end gap-2'>
            <button
              type='button'
              onClick={cancelForm}
              className='px-3 py-1.5 rounded-lg text-sm border border-[var(--juhe-border)] hover:bg-[var(--juhe-surface-2)] transition-colors'
            >
              {t('common.cancel')}
            </button>
            <button
              type='button'
              onClick={submitForm}
              disabled={!name.trim() || selectedProviderIds.length === 0}
              className='px-3 py-1.5 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground
                         hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 disabled:opacity-50 transition-colors'
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className='p-8 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-center text-[var(--juhe-text-3)]'>
          <Server className='w-8 h-8 mx-auto mb-2 opacity-50' />
          <p>{t('loadBalance.noGroups')}</p>
        </div>
      ) : (
        <div className='space-y-3'>
          {groups.map((group) => {
            const expanded = expandedId === group.id
            return (
              <div
                key={group.id}
                className={`rounded-xl border transition-colors ${
                  group.isEnabled
                    ? 'border-[var(--juhe-border)] bg-[var(--juhe-surface)]'
                    : 'border-[var(--juhe-border)]/50 bg-[var(--juhe-surface)]/50'
                }`}
              >
                <div className='p-4 flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <button
                      type='button'
                      onClick={() => setExpandedId(expanded ? null : group.id)}
                      className='p-1 rounded-md hover:bg-[var(--juhe-surface-2)] transition-colors'
                    >
                      {expanded ? (
                        <ChevronUp className='w-4 h-4 text-[var(--juhe-text-3)]' />
                      ) : (
                        <ChevronDown className='w-4 h-4 text-[var(--juhe-text-3)]' />
                      )}
                    </button>
                    <div>
                      <div className='flex items-center gap-2'>
                        <h3 className='text-sm font-semibold'>{group.name}</h3>
                        {!group.isEnabled && (
                          <span className='text-xs px-2 py-0.5 rounded-full bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)]'>
                            {t('loadBalance.disabled')}
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-[var(--juhe-text-3)]'>
                        {t(`loadBalance.strategies.${group.strategy}`)} · {group.providerIds.length}{' '}
                        {t('loadBalance.providersCount')}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-1'>
                    <button
                      type='button'
                      onClick={() => startEdit(group)}
                      className='p-1.5 rounded-lg hover:bg-[var(--juhe-surface-2)] transition-colors'
                      title={t('common.edit') as string}
                    >
                      <Edit3 className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      onClick={() => handleDelete(group.id)}
                      className='p-1.5 rounded-lg hover:bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)] transition-colors'
                      title={t('common.delete') as string}
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className='px-4 pb-4 space-y-3'>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-xs'>
                      <div className='p-2 rounded-lg bg-[var(--juhe-surface-2)]/50'>
                        <span className='text-[var(--juhe-text-3)]'>{t('loadBalance.interval')}</span>
                        <p className='font-medium'>{group.healthCheckInterval}s</p>
                      </div>
                      <div className='p-2 rounded-lg bg-[var(--juhe-surface-2)]/50'>
                        <span className='text-[var(--juhe-text-3)]'>{t('loadBalance.maxRetries')}</span>
                        <p className='font-medium'>{group.maxRetries}</p>
                      </div>
                      <div className='p-2 rounded-lg bg-[var(--juhe-surface-2)]/50'>
                        <span className='text-[var(--juhe-text-3)]'>{t('loadBalance.timeout')}</span>
                        <p className='font-medium'>{group.timeout}ms</p>
                      </div>
                      <div className='p-2 rounded-lg bg-[var(--juhe-surface-2)]/50'>
                        <span className='text-[var(--juhe-text-3)]'>{t('loadBalance.strategy')}</span>
                        <p className='font-medium'>{t(`loadBalance.strategies.${group.strategy}`)}</p>
                      </div>
                    </div>

                    <div className='space-y-1'>
                      <h4 className='text-xs font-medium text-[var(--juhe-text-3)] uppercase tracking-wide'>
                        {t('loadBalance.providerStatus')}
                      </h4>
                      <div className='space-y-1'>
                        {group.providerIds.map((pid) => {
                          const p = providers.find((pr) => pr.id === pid)
                          const h = health[pid]
                          return (
                            <div
                              key={pid}
                              className='flex items-center justify-between p-2 rounded-lg bg-[var(--juhe-surface-2)]/50'
                            >
                              <div className='flex items-center gap-2'>
                                {getStatusDot(h?.status || 'unknown')}
                                <span className='text-sm'>{p?.name || pid}</span>
                              </div>
                              <div className='flex items-center gap-3 text-xs text-[var(--juhe-text-3)]'>
                                {h && (
                                  <>
                                    <span className='flex items-center gap-1'>
                                      {getStatusIcon(h.status)}
                                      {t(`loadBalance.${h.status}`)}
                                    </span>
                                    <span>{h.avgLatency > 0 ? `${h.avgLatency}ms` : '-'}</span>
                                    <span>
                                      {t('loadBalance.successRate')}: {Math.round((h.successRate || 0) * 100)}%
                                    </span>
                                    <span>
                                      {t('loadBalance.lastChecked')}:{' '}
                                      {h.lastChecked ? new Date(h.lastChecked).toLocaleTimeString() : '-'}
                                    </span>
                                  </>
                                )}
                                {!h && <span className='italic'>{t('loadBalance.noHealthData')}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={deleteTargetId !== null}
        title={t('common.confirm', { defaultValue: 'Confirm' }) as string}
        description={t('common.confirm', { defaultValue: 'Are you sure?' }) as string}
        confirmText={t('common.delete', { defaultValue: 'Delete' }) as string}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' }) as string}
        danger
        onConfirm={() => {
          if (deleteTargetId) {
            deleteGroup(deleteTargetId)
          }
          setDeleteTargetId(null)
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  )
}
