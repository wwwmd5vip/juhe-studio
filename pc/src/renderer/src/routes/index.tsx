import type { GenerationTask, QueueState } from '@shared/types/generation'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Image,
  Layers,
  Layout,
  Loader2,
  LogOut,
  MessageSquare,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Video,
  Zap
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'

export const Route = createFileRoute('/')({
  component: HomePage
})

function HomePage() {
  const { t } = useTranslation()
  const [recentTasks, setRecentTasks] = useState<GenerationTask[]>([])
  const [queueState, setQueueState] = useState<QueueState | null>(null)
  const [stats, setStats] = useState({
    totalGenerated: 0,
    completedToday: 0,
    failedToday: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [taskList, state] = await Promise.all([window.api.generation.list(), window.api.queue.getState()])
        const tasks = taskList as GenerationTask[]
        setRecentTasks(tasks.slice(0, 5))
        setQueueState(state as QueueState)

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayTasks = tasks.filter((t) => t.createdAt >= today.getTime())

        setStats({
          totalGenerated: tasks.filter((t) => t.status === 'completed').length,
          completedToday: todayTasks.filter((t) => t.status === 'completed').length,
          failedToday: todayTasks.filter((t) => t.status === 'failed').length
        })
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    if (!window.api) return
    const removeStateListener = window.api.queue.onStateChange((_event, state) => {
      setQueueState(state as QueueState)
    })
    const removeProgressListener = window.api.generation.onProgress((_event, data) => {
      const progress = data as { taskId: string; status: string; progress: number; stage: string }
      setRecentTasks((prev) =>
        prev.map((task) =>
          task.id === progress.taskId
            ? {
                ...task,
                status: progress.status as GenerationTask['status'],
                progress: progress.progress,
                stage: progress.stage
              }
            : task
        )
      )
    })
    const removeProgressBatchListener = window.api.generation.onProgressBatch((_event, data) => {
      const batch = data as { taskId: string; status: string; progress: number; stage: string }[]
      setRecentTasks((prev) =>
        prev.map((task) => {
          const progress = batch.find((p) => p.taskId === task.id)
          if (!progress) return task
          return {
            ...task,
            status: progress.status as GenerationTask['status'],
            progress: progress.progress,
            stage: progress.stage
          }
        })
      )
    })

    return () => {
      removeStateListener()
      removeProgressListener()
      removeProgressBatchListener()
    }
  }, [])

  return (
    <div className='h-full overflow-auto relative' style={{ background: 'var(--juhe-void)' }}>
      {/* Background grid */}
      <div className='absolute inset-0 grid-bg opacity-30 pointer-events-none' />
      <div className='absolute inset-0 radial-glow pointer-events-none' />

      <div className='relative z-10'>
        {/* Header */}
        <div className='px-8 pt-8 pb-6'>
          <div className='flex items-center justify-between'>
            <div>
              <h1
                className='text-2xl font-bold'
                style={{ fontFamily: 'var(--font-display)', color: 'var(--juhe-text)', letterSpacing: '0.05em' }}
              >
                {t('app.name')}
              </h1>
              <p
                className='text-xs mt-1 tracking-wider uppercase'
                style={{ color: 'var(--juhe-text-3)', fontFamily: 'var(--font-mono)' }}
              >
                AI Aggregation Platform // v0.1.0
              </p>
            </div>
            {queueState && queueState.runningCount > 0 && (
              <div
                className='flex items-center gap-2 px-3 py-1.5 rounded-lg'
                style={{ background: 'rgba(0,240,255,0.06)', border: '1px solid rgba(0,240,255,0.12)' }}
              >
                <Loader2 className='w-3.5 h-3.5 animate-spin' style={{ color: 'var(--juhe-cyan)' }} />
                <span className='text-xs mono-num' style={{ color: 'var(--juhe-cyan)' }}>
                  {queueState.runningCount} RUNNING
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Account Overview */}
        <AccountPanel />

        {/* Quick Actions */}
        <div className='px-8 pb-6'>
          <div className='flex items-center gap-2 mb-3'>
            <div
              className='w-1 h-3 rounded-full'
              style={{ background: 'var(--juhe-magenta)', boxShadow: '0 0 8px var(--juhe-magenta)' }}
            />
            <h2
              className='text-[10px] font-semibold tracking-[0.2em] uppercase'
              style={{ color: 'var(--juhe-text-3)', fontFamily: 'var(--font-display)' }}
            >
              {t('dashboard.quickActions', { defaultValue: 'Quick Launch' })}
            </h2>
          </div>
          <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3'>
            <LaunchCard
              icon={<Sparkles size={18} />}
              title={t('generate.modes.image')}
              desc={t('home.aiCreationDesc')}
              href='/generate'
              accent='#00f0ff'
            />
            <LaunchCard
              icon={<Video size={18} />}
              title={t('generate.modes.video')}
              desc={t('dashboard.videoDesc')}
              href='/generate'
              accent='#ff2d95'
            />
            <LaunchCard
              icon={<MessageSquare size={18} />}
              title={t('nav.chat')}
              desc={t('dashboard.chatDesc')}
              href='/chat'
              accent='#10b981'
            />
            <LaunchCard
              icon={<Layout size={18} />}
              title={t('nav.canvas')}
              desc={t('home.infiniteCanvasDesc')}
              href='/canvas'
              accent='#f59e0b'
            />
            <LaunchCard
              icon={<Image size={18} />}
              title={t('imageProcess.title')}
              desc={t('dashboard.imageProcessDesc')}
              href='/generate'
              accent='#8b5cf6'
            />
          </div>
        </div>

        {/* Stats Overview */}
        <div className='px-8 pb-6'>
          <div className='flex items-center gap-2 mb-3'>
            <div
              className='w-1 h-3 rounded-full'
              style={{ background: 'var(--juhe-violet)', boxShadow: '0 0 8px var(--juhe-violet)' }}
            />
            <h2
              className='text-[10px] font-semibold tracking-[0.2em] uppercase'
              style={{ color: 'var(--juhe-text-3)', fontFamily: 'var(--font-display)' }}
            >
              {t('dashboard.overview', { defaultValue: 'System Overview' })}
            </h2>
          </div>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            <StatCard
              icon={<CheckCircle2 size={16} />}
              label={t('dashboard.totalGenerated')}
              value={stats.totalGenerated}
              isLoading={isLoading}
              color='var(--juhe-emerald)'
            />
            <StatCard
              icon={<TrendingUp size={16} />}
              label={t('dashboard.completedToday')}
              value={stats.completedToday}
              isLoading={isLoading}
              color='var(--juhe-cyan)'
            />
            <StatCard
              icon={<AlertCircle size={16} />}
              label={t('dashboard.failedToday')}
              value={stats.failedToday}
              isLoading={isLoading}
              color='var(--juhe-magenta)'
            />
            <StatCard
              icon={<Layers size={16} />}
              label={t('dashboard.queueTasks')}
              value={queueState?.totalTasks ?? 0}
              isLoading={isLoading}
              color='var(--juhe-violet)'
            />
          </div>
        </div>

        {/* Recent Tasks & Queue Status */}
        <div className='px-8 pb-8'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <PanelCard title={t('dashboard.recentTasks')} linkTo='/queue' linkText={t('dashboard.viewAll')}>
              {recentTasks.length === 0 ? (
                <EmptyState
                  icon={<Clock size={24} />}
                  text={t('history.empty.noRecords')}
                  linkTo='/generate'
                  linkText={t('history.empty.goGenerate')}
                />
              ) : (
                <div className='divide-y' style={{ borderColor: 'var(--juhe-divider)' }}>
                  {recentTasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              )}
            </PanelCard>

            <PanelCard title={t('dashboard.queueStatus')} linkTo='/queue' linkText={t('dashboard.manageQueue')}>
              {queueState ? (
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <div
                        className={`w-2 h-2 rounded-full ${queueState.isPaused ? '' : 'animate-pulse'}`}
                        style={{
                          background: queueState.isPaused ? 'var(--juhe-amber)' : 'var(--juhe-emerald)',
                          boxShadow: queueState.isPaused ? '0 0 8px var(--juhe-amber)' : '0 0 8px var(--juhe-emerald)'
                        }}
                      />
                      <span
                        className='text-xs font-medium'
                        style={{ color: queueState.isPaused ? 'var(--juhe-amber)' : 'var(--juhe-emerald)' }}
                      >
                        {queueState.isPaused ? t('queue.status.paused') : t('queue.status.processing')}
                      </span>
                    </div>
                    <span
                      className='text-[10px] tracking-wider uppercase'
                      style={{ color: 'var(--juhe-text-3)', fontFamily: 'var(--font-mono)' }}
                    >
                      CONCURRENCY: {queueState.maxConcurrent}
                    </span>
                  </div>
                  <div className='space-y-2.5'>
                    <QueueBar
                      label={t('queue.stats.running')}
                      count={queueState.runningCount}
                      total={queueState.totalTasks}
                      color='var(--juhe-cyan)'
                    />
                    <QueueBar
                      label={t('queue.stats.waiting')}
                      count={queueState.pendingCount}
                      total={queueState.totalTasks}
                      color='var(--juhe-text-3)'
                    />
                    <QueueBar
                      label={t('queue.stats.completed')}
                      count={queueState.completedCount}
                      total={queueState.totalTasks}
                      color='var(--juhe-emerald)'
                    />
                    <QueueBar
                      label={t('queue.stats.failed')}
                      count={queueState.failedCount}
                      total={queueState.totalTasks}
                      color='var(--juhe-magenta)'
                    />
                  </div>
                  <Link
                    to='/queue'
                    className='block text-center py-2.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02]'
                    style={{
                      background: 'linear-gradient(135deg, var(--juhe-cyan), var(--juhe-violet))',
                      color: '#050508',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {t('dashboard.openQueue')}
                  </Link>
                </div>
              ) : (
                <EmptyState icon={<Zap size={24} />} text={t('queue.empty.noTasks')} />
              )}
            </PanelCard>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ===== Sub-components ===== */

function LaunchCard({
  icon,
  title,
  desc,
  href,
  accent
}: {
  icon: React.ReactNode
  title: string
  desc: string
  href: string
  accent: string
}) {
  return (
    <Link
      to={href}
      className='group flex flex-col p-4 rounded-xl transition-all duration-200 hover:-translate-y-1 active:scale-[0.98]'
      style={{
        background: 'var(--juhe-surface)',
        border: '1px solid var(--juhe-border)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent
        e.currentTarget.style.boxShadow = `0 0 20px ${accent}20`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--juhe-border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div
        className='w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-all duration-200 group-hover:scale-110'
        style={{ background: `${accent}15`, color: accent }}
      >
        {icon}
      </div>
      <h3 className='text-sm font-semibold mb-0.5 transition-colors' style={{ color: 'var(--juhe-text)' }}>
        {title}
      </h3>
      <p className='text-[11px] line-clamp-2' style={{ color: 'var(--juhe-text-3)' }}>
        {desc}
      </p>
    </Link>
  )
}

function StatCard({
  icon,
  label,
  value,
  isLoading,
  color
}: {
  icon: React.ReactNode
  label: string
  value: number
  isLoading: boolean
  color: string
}) {
  return (
    <div className='glass-card p-4' style={{ borderColor: 'var(--juhe-border)' }}>
      <div className='flex items-center gap-2 mb-2'>
        <div style={{ color }}>{icon}</div>
        <span
          className='text-[10px] tracking-wider uppercase'
          style={{ color: 'var(--juhe-text-3)', fontFamily: 'var(--font-mono)' }}
        >
          {label}
        </span>
      </div>
      <div className='text-2xl font-bold mono-num' style={{ color }}>
        {isLoading ? <Skeleton className='w-12 h-7 rounded' /> : value}
      </div>
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-[var(--juhe-surface-2)] animate-pulse ${className}`} />
}

function PanelCard({
  title,
  linkTo,
  linkText,
  children
}: {
  title: string
  linkTo?: string
  linkText?: string
  children: React.ReactNode
}) {
  return (
    <div
      className='rounded-xl overflow-hidden'
      style={{ background: 'var(--juhe-surface)', border: '1px solid var(--juhe-border)' }}
    >
      <div
        className='flex items-center justify-between px-4 py-3'
        style={{ borderBottom: '1px solid var(--juhe-divider)' }}
      >
        <h3
          className='text-[10px] font-semibold tracking-[0.2em] uppercase'
          style={{ color: 'var(--juhe-text-3)', fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h3>
        {linkTo && linkText && (
          <Link
            to={linkTo}
            className='text-[10px] tracking-wider uppercase transition-colors hover:text-white flex items-center gap-1'
            style={{ color: 'var(--juhe-cyan)', fontFamily: 'var(--font-mono)' }}
          >
            {linkText} <ChevronRight size={10} />
          </Link>
        )}
      </div>
      <div className='p-4'>{children}</div>
    </div>
  )
}

function EmptyState({
  icon,
  text,
  linkTo,
  linkText
}: {
  icon: React.ReactNode
  text: string
  linkTo?: string
  linkText?: string
}) {
  return (
    <div className='flex flex-col items-center justify-center py-12'>
      <div className='mb-3 opacity-20' style={{ color: 'var(--juhe-text-3)' }}>
        {icon}
      </div>
      <p className='text-xs' style={{ color: 'var(--juhe-text-3)' }}>
        {text}
      </p>
      {linkTo && linkText && (
        <Link
          to={linkTo}
          className='text-[11px] mt-2 transition-colors hover:text-white'
          style={{ color: 'var(--juhe-cyan)' }}
        >
          {linkText}
        </Link>
      )}
    </div>
  )
}

function TaskRow({ task }: { task: GenerationTask }) {
  const { t } = useTranslation()
  const statusConfig: Record<string, { color: string; glow: string; icon: React.ReactNode }> = {
    pending: { color: 'var(--juhe-text-3)', glow: 'transparent', icon: <Clock size={12} /> },
    processing: {
      color: 'var(--juhe-cyan)',
      glow: 'rgba(0,240,255,0.1)',
      icon: <Loader2 size={12} className='animate-spin' />
    },
    completed: { color: 'var(--juhe-emerald)', glow: 'rgba(16,185,129,0.1)', icon: <CheckCircle2 size={12} /> },
    failed: { color: 'var(--juhe-magenta)', glow: 'rgba(255,45,149,0.1)', icon: <AlertCircle size={12} /> },
    cancelled: { color: 'var(--juhe-amber)', glow: 'rgba(245,158,11,0.1)', icon: <Clock size={12} /> },
    paused: { color: 'var(--juhe-amber)', glow: 'rgba(245,158,11,0.1)', icon: <Clock size={12} /> }
  }
  const status = statusConfig[task.status] || statusConfig.pending
  const typeIcon =
    task.type === 'image' ? <Image size={12} /> : task.type === 'video' ? <Video size={12} /> : <Sparkles size={12} />

  return (
    <div className='flex items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-white/[0.02]'>
      <div style={{ color: 'var(--juhe-text-3)' }}>{typeIcon}</div>
      <div className='flex-1 min-w-0'>
        <p className='text-[11px] font-medium truncate' style={{ color: 'var(--juhe-text-2)' }}>
          {task.params.prompt || t('queue.taskInfo.noPrompt')}
        </p>
        <p className='text-[9px]' style={{ color: 'var(--juhe-text-dim)' }}>
          {task.params.model || t('queue.taskInfo.defaultModel')} · {formatTime(task.createdAt, t)}
        </p>
      </div>
      <div className='flex items-center gap-1 text-[10px]' style={{ color: status.color }}>
        {status.icon}
        <span className='hidden sm:inline'>{t(`queue.status.${task.status}`)}</span>
      </div>
      {task.status === 'processing' && (
        <div className='w-12'>
          <div className='h-1 rounded-full overflow-hidden' style={{ background: 'var(--juhe-void-3)' }}>
            <div
              className='h-full rounded-full transition-all duration-300'
              style={{
                width: `${task.progress}%`,
                background: 'linear-gradient(90deg, var(--juhe-cyan), var(--juhe-violet))'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function QueueBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className='flex items-center justify-between text-[10px] mb-1'>
        <span style={{ color: 'var(--juhe-text-3)' }}>{label}</span>
        <span className='font-medium mono-num' style={{ color }}>
          {count}
        </span>
      </div>
      <div className='h-1 rounded-full overflow-hidden' style={{ background: 'var(--juhe-void-3)' }}>
        <div
          className='h-full rounded-full transition-all duration-500'
          style={{ width: `${percentage}%`, background: color, boxShadow: `0 0 8px ${color}40` }}
        />
      </div>
    </div>
  )
}

function AccountPanel() {
  const { t } = useTranslation()
  const { user, refreshProfile, logout } = useAuthStore()
  const [refreshing, setRefreshing] = useState(false)

  if (!user) return null

  // Server stores quota in cents (分). Convert to yuan (元) for display.
  const isRoot = user.role === 100
  const usedCents = user.used_quota || 0
  const totalCents = user.quota || 0
  const usedYuan = usedCents / 100
  const totalYuan = totalCents / 100
  const isUnlimited = isRoot && totalCents === 0
  const pct = !isUnlimited && totalCents > 0 ? Math.min((usedCents / totalCents) * 100, 100) : 0

  const formatYuan = (v: number) => (v >= 10000 ? `¥${(v / 10000).toFixed(2)}万` : `¥${v.toFixed(2)}`)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshProfile()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className='px-8 pb-6'>
      <div
        className='rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4'
        style={{ background: 'var(--juhe-surface)', border: '1px solid var(--juhe-border)' }}
      >
        {/* User info */}
        <div className='flex items-center gap-3 min-w-0 flex-1'>
          <div
            className='w-9 h-9 rounded-lg flex items-center justify-center shrink-0'
            style={{ background: 'rgba(0,240,255,0.1)', color: 'var(--juhe-cyan)' }}
          >
            <Shield size={16} />
          </div>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <span className='text-sm font-semibold truncate' style={{ color: 'var(--juhe-text)' }}>
                {user.username}
              </span>
              <span
                className='text-[10px] px-1.5 py-0.5 rounded'
                style={{ background: 'rgba(0,240,255,0.08)', color: 'var(--juhe-cyan)' }}
              >
                {user.group || 'default'}
              </span>
            </div>
            <span className='text-[10px]' style={{ color: 'var(--juhe-text-3)' }}>
              {t('newapi.account')}
            </span>
          </div>
        </div>

        {/* Quota */}
        <div className='flex items-center gap-3 sm:flex-1 sm:justify-end'>
          <div className='flex flex-col items-end'>
            <span className='text-xs mono-num' style={{ color: 'var(--juhe-text-2)' }}>
              {formatYuan(usedYuan)}
              <span style={{ color: 'var(--juhe-text-3)' }}>
                {' '}
                / {isUnlimited ? t('newapi.unlimitedQuota') : formatYuan(totalYuan)}
              </span>
            </span>
            <span className='text-[10px]' style={{ color: 'var(--juhe-text-3)' }}>
              {t('newapi.usedQuota')} / {t('newapi.quota')}
            </span>
          </div>

          {/* Progress ring — skip for unlimited quota */}
          {!isUnlimited && totalCents > 0 && (
            <div className='relative w-11 h-11 shrink-0'>
              {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
              <svg className='w-full h-full -rotate-90' viewBox='0 0 44 44'>
                <circle cx='22' cy='22' r='19' fill='none' stroke='var(--juhe-void-3)' strokeWidth='3' />
                <circle
                  cx='22'
                  cy='22'
                  r='19'
                  fill='none'
                  stroke={pct > 90 ? 'var(--juhe-magenta)' : 'var(--juhe-cyan)'}
                  strokeWidth='3'
                  strokeLinecap='round'
                  strokeDasharray={`${(pct / 100) * 119.38} 119.38`}
                  style={{ transition: 'stroke-dasharray 1s ease' }}
                />
              </svg>
              <span
                className='absolute inset-0 flex items-center justify-center text-[9px] font-semibold mono-num'
                style={{ color: 'var(--juhe-text-2)' }}
              >
                {Math.round(pct)}%
              </span>
            </div>
          )}

          {/* Refresh quota button */}
          <button
            type='button'
            onClick={handleRefresh}
            disabled={refreshing}
            className='shrink-0 p-2 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-50'
            style={{ color: 'var(--juhe-text-3)' }}
            title={t('newapi.refreshQuota')}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Logout */}
        <button
          type='button'
          onClick={() => logout()}
          className='shrink-0 p-2 rounded-lg transition-colors hover:bg-white/5'
          style={{ color: 'var(--juhe-text-3)' }}
          title={t('newapi.logout')}
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  )
}

function formatTime(timestamp: number, t?: (key: string, options?: Record<string, unknown>) => string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (!t) {
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }
  if (minutes < 1) return t('home.justNow')
  if (minutes < 60) return t('home.minutesAgo', { count: minutes })
  if (hours < 24) return t('home.hoursAgo', { count: hours })
  return t('home.daysAgo', { count: days })
}
