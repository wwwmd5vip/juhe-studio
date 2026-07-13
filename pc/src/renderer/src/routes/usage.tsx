import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Image,
  Layers,
  Trash2,
  Video,
  XCircle
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SkeletonRows } from '@/components/Skeleton'
import { useUsageStore } from '@/stores/usage'

export const Route = createFileRoute('/usage')({
  component: UsagePage
})

function UsagePage() {
  const { t } = useTranslation()
  const { records, getTodayUsage, getProviderStats, getDailyStats, clearRecords } = useUsageStore()
  const [trendDays, setTrendDays] = useState<7 | 30>(7)
  const [loading, setLoading] = useState(true)

  // Simulate brief initial hydration (Zustand persist is async)
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 0)
    return () => clearTimeout(timer)
  }, [])

  const today = getTodayUsage()
  const totalCount = records.length
  const _totalCost = records.reduce((sum, r) => sum + r.cost, 0)
  const successCount = records.filter((r) => r.status === 'success').length
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0
  const _avgDuration = totalCount > 0 ? Math.round(records.reduce((sum, r) => sum + r.duration, 0) / totalCount) : 0

  const providerStats = useMemo(() => getProviderStats(), [getProviderStats])
  const dailyStats = useMemo(() => getDailyStats(trendDays), [trendDays, getDailyStats])

  const maxDailyCost = Math.max(...dailyStats.map((d) => d.cost), 0.001)
  const maxDailyCount = Math.max(...dailyStats.map((d) => d.count), 1)

  const formatCurrency = (v: number) => `$${v.toFixed(4)}`
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className='w-3.5 h-3.5' />
      case 'video':
        return <Video className='w-3.5 h-3.5' />
      default:
        return <FileText className='w-3.5 h-3.5' />
    }
  }

  return (
    <div className='flex flex-col h-full overflow-hidden' style={{ background: 'var(--juhe-void)' }}>
      {/* Header */}
      <div className='flex items-center justify-between px-6 py-4 border-b border-[var(--juhe-border)] shrink-0'>
        <div className='flex items-center gap-2'>
          <BarChart3 className='w-5 h-5' />
          <h1 className='text-lg font-semibold'>{t('usage.title')}</h1>
        </div>
        <button
          type='button'
          onClick={clearRecords}
          className='flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-magenta)]/10 hover:text-[var(--juhe-magenta)] transition-colors'
          title={t('usage.clearHistory')}
        >
          <Trash2 className='w-3.5 h-3.5' />
          {t('usage.clearHistory')}
        </button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-6 py-4 space-y-6'>
        {loading ? (
          <div className='space-y-6'>
            {/* Overview cards skeleton */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                  key={i}
                  className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-3 flex items-center gap-3'
                >
                  <SkeletonRows count={1} className='h-8 w-8 rounded-md' />
                  <div className='flex-1 space-y-2'>
                    <SkeletonRows count={1} className='h-3 w-16' />
                    <SkeletonRows count={1} className='h-6 w-12' />
                  </div>
                </div>
              ))}
            </div>
            {/* Chart section skeletons */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
              <div className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-4'>
                <SkeletonRows count={1} className='h-4 w-32 mb-3' />
                <SkeletonRows count={5} className='h-8 w-full' />
              </div>
              <div className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-4'>
                <SkeletonRows count={1} className='h-4 w-32 mb-3' />
                <div className='h-24'>
                  <SkeletonRows count={1} className='h-full w-full rounded' />
                </div>
              </div>
            </div>
            {/* Cost estimation skeleton */}
            <div className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-4'>
              <SkeletonRows count={1} className='h-4 w-40 mb-3' />
              <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                {Array.from({ length: 3 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<div key={i} className='flex items-center gap-3 p-3 rounded-md bg-[var(--juhe-surface-2)]/50'>
                    <div className='p-2 rounded-md bg-[var(--juhe-void-2)]'>
                      <SkeletonRows count={1} className='h-4 w-4' />
                    </div>
                    <div className='space-y-1'>
                      <SkeletonRows count={1} className='h-3 w-16' />
                      <SkeletonRows count={1} className='h-3 w-20' />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Recent calls skeleton */}
            <div className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-4'>
              <SkeletonRows count={1} className='h-4 w-32 mb-3' />
              <SkeletonRows count={8} className='h-8 w-full' />
            </div>
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              <OverviewCard
                icon={<Activity className='w-4 h-4 text-[var(--juhe-cyan)]' />}
                label={t('usage.todayRequests')}
                value={String(today.count)}
              />
              <OverviewCard
                icon={<DollarSign className='w-4 h-4 text-[var(--juhe-emerald)]' />}
                label={t('usage.todayCost')}
                value={formatCurrency(today.cost)}
              />
              <OverviewCard
                icon={<Layers className='w-4 h-4 text-[var(--juhe-violet)]' />}
                label={t('usage.totalRequests')}
                value={String(totalCount)}
              />
              <OverviewCard
                icon={<CheckCircle className='w-4 h-4 text-[var(--juhe-emerald)]' />}
                label={t('usage.successRate')}
                value={`${successRate}%`}
              />
            </div>

            {/* Provider Breakdown + Daily Trend */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
              {/* Provider Breakdown */}
              <div className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-4'>
                <h2 className='text-sm font-semibold mb-3'>{t('usage.providerBreakdown')}</h2>
                {providerStats.length === 0 ? (
                  <EmptyState message={t('usage.noRecords')} />
                ) : (
                  <div className='overflow-x-auto'>
                    <table className='w-full text-xs'>
                      <thead>
                        <tr className='text-[var(--juhe-text-3)] border-b border-[var(--juhe-border)]'>
                          <th className='text-left py-2 font-medium'>{t('usage.providerBreakdown')}</th>
                          <th className='text-right py-2 font-medium'>{t('usage.records')}</th>
                          <th className='text-right py-2 font-medium'>{t('usage.todayCost')}</th>
                          <th className='text-right py-2 font-medium'>{t('usage.successRate')}</th>
                          <th className='text-right py-2 font-medium'>{t('usage.avgLatency')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {providerStats.map((p) => {
                          const providerRecords = records.filter((r) => r.providerId === p.providerId)
                          const avgLat =
                            providerRecords.length > 0
                              ? Math.round(providerRecords.reduce((s, r) => s + r.duration, 0) / providerRecords.length)
                              : 0
                          return (
                            <tr key={p.providerId} className='border-b border-[var(--juhe-border)]/50 last:border-0'>
                              <td className='py-2 font-medium'>{p.providerName}</td>
                              <td className='py-2 text-right'>{p.count}</td>
                              <td className='py-2 text-right'>{formatCurrency(p.cost)}</td>
                              <td className='py-2 text-right'>{p.successRate}%</td>
                              <td className='py-2 text-right'>{formatDuration(avgLat)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Daily Trend */}
              <div className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-4'>
                <div className='flex items-center justify-between mb-3'>
                  <h2 className='text-sm font-semibold'>{t('usage.dailyTrend')}</h2>
                  <div className='flex bg-[var(--juhe-surface-2)] rounded-md p-0.5'>
                    <button
                      type='button'
                      onClick={() => setTrendDays(7)}
                      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                        trendDays === 7
                          ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                          : 'text-[var(--juhe-text-3)]'
                      }`}
                    >
                      7D
                    </button>
                    <button
                      type='button'
                      onClick={() => setTrendDays(30)}
                      className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                        trendDays === 30
                          ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                          : 'text-[var(--juhe-text-3)]'
                      }`}
                    >
                      30D
                    </button>
                  </div>
                </div>
                {dailyStats.every((d) => d.count === 0) ? (
                  <EmptyState message={t('usage.noRecords')} />
                ) : (
                  <div className='space-y-4'>
                    {/* Requests bar chart */}
                    <div>
                      <div className='text-[10px] text-[var(--juhe-text-3)] mb-1'>{t('usage.todayRequests')}</div>
                      <div className='flex items-end gap-1 h-24'>
                        {dailyStats.map((d) => (
                          <div key={d.date} className='flex-1 flex flex-col items-center gap-1'>
                            <div
                              className='w-full bg-[var(--juhe-cyan)]/80 rounded-t-sm min-h-[2px]'
                              style={{ height: `${(d.count / maxDailyCount) * 100}%` }}
                              title={`${d.date}: ${d.count}`}
                            />
                            <span className='text-[9px] text-[var(--juhe-text-3)]'>{d.date.slice(5)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Cost bar chart */}
                    <div>
                      <div className='text-[10px] text-[var(--juhe-text-3)] mb-1'>{t('usage.todayCost')}</div>
                      <div className='flex items-end gap-1 h-24'>
                        {dailyStats.map((d) => (
                          <div key={`cost-${d.date}`} className='flex-1 flex flex-col items-center gap-1'>
                            <div
                              className='w-full bg-[var(--juhe-emerald)]/80 rounded-t-sm min-h-[2px]'
                              style={{ height: `${(d.cost / maxDailyCost) * 100}%` }}
                              title={`${d.date}: ${formatCurrency(d.cost)}`}
                            />
                            <span className='text-[9px] text-[var(--juhe-text-3)]'>{d.date.slice(5)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cost Estimation */}
            <div className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-4'>
              <h2 className='text-sm font-semibold mb-3'>{t('usage.costEstimation')}</h2>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                <CostEstimationCard
                  type='image'
                  rate='~$0.04 / call'
                  icon={<Image className='w-4 h-4 text-blue-400' />}
                />
                <CostEstimationCard
                  type='video'
                  rate='~$0.50 / call'
                  icon={<Video className='w-4 h-4 text-purple-400' />}
                />
                <CostEstimationCard
                  type='text'
                  rate='~$0.002 / call'
                  icon={<FileText className='w-4 h-4 text-green-400' />}
                />
              </div>
            </div>

            {/* Recent Calls */}
            <div className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-4'>
              <h2 className='text-sm font-semibold mb-3'>{t('usage.recentCalls')}</h2>
              {records.length === 0 ? (
                <EmptyState message={t('usage.noRecords')} />
              ) : (
                <div className='overflow-x-auto'>
                  <table className='w-full text-xs'>
                    <thead>
                      <tr className='text-[var(--juhe-text-3)] border-b border-[var(--juhe-border)]'>
                        <th className='text-left py-2 font-medium'>{t('usage.providerBreakdown')}</th>
                        <th className='text-left py-2 font-medium'>{t('generate.modelSelector.model')}</th>
                        <th className='text-left py-2 font-medium'>{t('queue.tableHeaders.type')}</th>
                        <th className='text-right py-2 font-medium'>{t('usage.tokens')}</th>
                        <th className='text-right py-2 font-medium'>{t('usage.todayCost')}</th>
                        <th className='text-right py-2 font-medium'>{t('usage.duration')}</th>
                        <th className='text-left py-2 font-medium'>{t('queue.tableHeaders.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.slice(0, 50).map((r) => (
                        <tr key={r.id} className='border-b border-[var(--juhe-border)]/50 last:border-0'>
                          <td className='py-2 font-medium'>{r.providerName}</td>
                          <td className='py-2'>{r.modelName}</td>
                          <td className='py-2'>
                            <div className='flex items-center gap-1'>
                              {typeIcon(r.type)}
                              <span className='capitalize'>{r.type}</span>
                            </div>
                          </td>
                          <td className='py-2 text-right'>{r.tokens ?? '-'}</td>
                          <td className='py-2 text-right'>{formatCurrency(r.cost)}</td>
                          <td className='py-2 text-right'>
                            <div className='flex items-center justify-end gap-1'>
                              <Clock className='w-3 h-3 text-[var(--juhe-text-3)]' />
                              {formatDuration(r.duration)}
                            </div>
                          </td>
                          <td className='py-2'>
                            {r.status === 'success' ? (
                              <span className='inline-flex items-center gap-1 text-[var(--juhe-emerald)]'>
                                <CheckCircle className='w-3 h-3' />
                                {t('usage.status.success')}
                              </span>
                            ) : (
                              <span className='inline-flex items-center gap-1 text-[var(--juhe-magenta)]'>
                                <XCircle className='w-3 h-3' />
                                {t('usage.status.failed')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function OverviewCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className='bg-[var(--juhe-surface)] border border-[var(--juhe-border)] rounded-lg p-3 flex items-center gap-3'>
      <div className='p-2 rounded-md bg-[var(--juhe-surface-2)]'>{icon}</div>
      <div>
        <div className='text-[10px] text-[var(--juhe-text-3)]'>{label}</div>
        <div className='text-lg font-bold'>{value}</div>
      </div>
    </div>
  )
}

function CostEstimationCard({ type, rate, icon }: { type: string; rate: string; icon: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className='flex items-center gap-3 p-3 rounded-md bg-[var(--juhe-surface-2)]/50'>
      <div className='p-2 rounded-md bg-[var(--juhe-void-2)]'>{icon}</div>
      <div>
        <div className='text-xs font-medium capitalize'>{t(`queue.types.${type}`)}</div>
        <div className='text-[10px] text-[var(--juhe-text-3)]'>{rate}</div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className='flex flex-col items-center justify-center py-8 text-[var(--juhe-text-3)]'>
      <BarChart3 className='w-10 h-10 mb-2 opacity-20' />
      <p className='text-xs'>{message}</p>
    </div>
  )
}
