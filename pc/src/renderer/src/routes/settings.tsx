import { createFileRoute } from '@tanstack/react-router'
import {
  AlertCircle,
  Check,
  CheckCircle,
  Command,
  Database,
  Download,
  Keyboard,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Trash2
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'
import FeedbackModal from '@/components/FeedbackModal'
import LoraManager from '@/components/lora/LoraManager'
import { ProviderManager } from '@/components/provider'
import { LoadBalancePanel } from '@/components/provider/LoadBalancePanel'
import { McpSettings } from '@/components/settings/McpSettings'
import { error as toastError } from '@/components/ui/toast'
import { useShortcutsStore } from '@/stores/shortcuts'
import { useThemeStore } from '@/stores/theme'

export const Route = createFileRoute('/settings')({
  component: SettingsPage
})

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { mode, resolved, setMode } = useThemeStore()
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'providers' | 'loadbalance' | 'lora' | 'mcp' | 'shortcuts'>(
    'general'
  )

  // Detect first launch: if juheBaseUrl is empty, start in onboarding mode
  useEffect(() => {
    window.api.config
      .get<string>('juheBaseUrl')
      .then((url) => {
        if (!url) {
          setIsOnboarding(true)
          setActiveTab('providers')
        }
      })
      .catch(() => {})
  }, [])
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; percent?: number; message?: string }>({})

  // Data management states
  const [_setStorageLoading] = useState(false)
  const [storageInfo, setStorageInfo] = useState<{
    dbPath: string
    dbSize: number
    dbSizeFormatted: string
    cfgPath: string
    cfgSize: number
    cfgSizeFormatted: string
  } | null>(null)
  const [clearingCache, setClearingCache] = useState(false)
  const [clearingDb, setClearingDb] = useState(false)
  const [cacheCleared, setCacheCleared] = useState(false)
  const [dbCleared, setDbCleared] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {})
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  useEffect(() => {
    const remove = window.api.updater?.onStatus((_event: unknown, payload: { status: string; data?: unknown }) => {
      const { status, data } = payload
      switch (status) {
        case 'checking':
          setUpdateStatus('checking')
          break
        case 'available':
          setUpdateStatus('available')
          setUpdateInfo({ version: (data as { version?: string })?.version })
          break
        case 'not-available':
          setUpdateStatus('not-available')
          break
        case 'progress':
          setUpdateStatus('downloading')
          setUpdateInfo({ percent: (data as { percent?: number })?.percent })
          break
        case 'downloaded':
          setUpdateStatus('downloaded')
          setUpdateInfo({ version: (data as { version?: string })?.version })
          break
        case 'error':
          setUpdateStatus('error')
          setUpdateInfo({ message: (data as { message?: string })?.message })
          break
      }
    })
    return remove
  }, [])

  const handleCheckUpdate = useCallback(() => {
    setUpdateStatus('checking')
    window.api.updater?.check()
  }, [])

  const handleDownload = useCallback(() => {
    setUpdateStatus('downloading')
    window.api.updater?.download()
  }, [])

  const handleInstall = useCallback(() => {
    window.api.updater?.install()
  }, [])

  // Data management
  useEffect(() => {
    if (activeTab === 'general') {
      window.api.system
        ?.getStorageInfo()
        .then(setStorageInfo)
        .catch((err: unknown) => {
          console.error(err)
          const message = err instanceof Error ? err.message : String(err)
          toastError({ title: t('settings.title'), description: message })
        })
    }
  }, [activeTab, t])

  const handleClearCache = useCallback(() => {
    setConfirmAction(() => async () => {
      setConfirmOpen(false)
      setClearingCache(true)
      try {
        await window.api.system?.clearCache()
        setCacheCleared(true)
        // Refresh storage info
        const info = await window.api.system?.getStorageInfo()
        setStorageInfo(info)
      } catch (err) {
        console.error(err)
        const message = err instanceof Error ? err.message : String(err)
        toastError({ title: t('settings.clearCache'), description: message })
      }
      setClearingCache(false)
    })
    setConfirmOpen(true)
  }, [t])

  const handleClearDatabase = useCallback(() => {
    setConfirmAction(() => async () => {
      setConfirmOpen(false)
      setClearingDb(true)
      try {
        await window.api.system?.clearDatabase()
        setDbCleared(true)
        // Refresh storage info
        const info = await window.api.system?.getStorageInfo()
        setStorageInfo(info)
      } catch (err) {
        console.error(err)
        const message = err instanceof Error ? err.message : String(err)
        toastError({ title: t('settings.clearDatabase'), description: message })
      }
      setClearingDb(false)
    })
    setConfirmOpen(true)
  }, [t])

  return (
    <div className='p-8 h-full' style={{ background: 'var(--juhe-void)' }}>
      <h1 className='text-2xl font-bold mb-6'>{t('settings.title')}</h1>

      {/* Tab Navigation */}
      <div className='flex gap-1 mb-6 border-b border-[var(--juhe-border)]'>
        <button
          type='button'
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
              : 'border-transparent text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
          }`}
        >
          {t('settings.general')}
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'providers'
              ? 'border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
              : 'border-transparent text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
          }`}
        >
          {t('settings.providers')}
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('loadbalance')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'loadbalance'
              ? 'border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
              : 'border-transparent text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
          }`}
        >
          {t('loadBalance.title')}
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('lora')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'lora'
              ? 'border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
              : 'border-transparent text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
          }`}
        >
          {t('settings.lora')}
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('shortcuts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'shortcuts'
              ? 'border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
              : 'border-transparent text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
          }`}
        >
          {t('shortcuts.title')}
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('mcp')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'mcp'
              ? 'border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
              : 'border-transparent text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
          }`}
        >
          {t('settings.mcp.title')}
        </button>
      </div>

      {activeTab === 'general' && (
        <div className='max-w-2xl space-y-6'>
          {/* Theme */}
          <section className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
            <h2 className='text-lg font-semibold mb-4'>{t('settings.appearance')}</h2>
            <div className='flex items-center justify-between'>
              <span className='text-[var(--juhe-text-3)]'>{t('settings.theme')}</span>
              <div className='flex gap-2'>
                {(['light', 'dark', 'system'] as const).map((m) => (
                  <button
                    type='button'
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      mode === m
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-void-3)] hover:bg-[var(--juhe-void-3)]/80'
                    }`}
                  >
                    {t(`theme.${m}`)}
                  </button>
                ))}
              </div>
            </div>
            <p className='mt-2 text-xs text-[var(--juhe-text-3)]'>
              {t('settings.currentTheme', { theme: t(`theme.${resolved}`) })}
            </p>
          </section>

          {/* Language */}
          <section className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
            <h2 className='text-lg font-semibold mb-4'>{t('settings.language')}</h2>
            <div className='flex items-center justify-between'>
              <span className='text-[var(--juhe-text-3)]'>{t('settings.language')}</span>
              <div className='flex gap-2'>
                {(['zh-CN', 'en'] as const).map((lang) => (
                  <button
                    type='button'
                    key={lang}
                    onClick={() => i18n.changeLanguage(lang)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      i18n.language === lang
                        ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                        : 'bg-[var(--juhe-void-3)] hover:bg-[var(--juhe-void-3)]/80'
                    }`}
                  >
                    {lang === 'zh-CN' ? t('settings.chinese') : t('settings.english')}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* About */}
          <section className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
            <h2 className='text-lg font-semibold mb-4'>{t('settings.about')}</h2>
            <div className='text-sm text-[var(--juhe-text-3)] space-y-1'>
              <p>{t('app.name')} v0.1.0</p>
              <p>Electron + React + TypeScript</p>
            </div>
          </section>

          {/* Data Management */}
          <section className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
            <h2 className='text-lg font-semibold mb-4'>{t('settings.dataManagement')}</h2>

            {/* Storage info */}
            {storageInfo && (
              <div className='mb-4 flex gap-4 text-sm text-[var(--juhe-text-3)]'>
                <div className='flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--juhe-void-3)]/40'>
                  <Database className='w-4 h-4 text-[var(--juhe-cyan)]' />
                  <span>{t('settings.databaseSize')}:</span>
                  <span className='font-mono text-[var(--juhe-text)]'>{storageInfo.dbSizeFormatted}</span>
                </div>
                <div className='flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--juhe-void-3)]/40'>
                  <Server className='w-4 h-4 text-[var(--juhe-violet)]' />
                  <span>{t('settings.cacheSize')}:</span>
                  <span className='font-mono text-[var(--juhe-text)]'>{storageInfo.cfgSizeFormatted}</span>
                </div>
              </div>
            )}

            <div className='space-y-3'>
              {/* Clear Cache */}
              <div className='flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--juhe-void-3)]/30'>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium'>{t('settings.clearCache')}</p>
                  <p className='text-xs text-[var(--juhe-text-3)]'>{t('settings.clearCacheDesc')}</p>
                </div>
                <button
                  type='button'
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className='px-3 py-1.5 rounded-lg text-sm bg-[var(--juhe-surface-2)] hover:bg-[var(--juhe-magenta)]/20 hover:text-[var(--juhe-magenta)] border border-[var(--juhe-border)] transition-colors flex items-center gap-1.5 disabled:opacity-50 ml-3 shrink-0'
                >
                  {clearingCache ? (
                    <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                  ) : cacheCleared ? (
                    <CheckCircle className='w-3.5 h-3.5 text-[var(--juhe-emerald)]' />
                  ) : (
                    <Trash2 className='w-3.5 h-3.5' />
                  )}
                  {clearingCache
                    ? t('settings.clearing')
                    : cacheCleared
                      ? t('settings.cleared')
                      : t('settings.clearCache')}
                </button>
              </div>

              {/* Clear Database */}
              <div className='flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--juhe-void-3)]/30'>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium'>{t('settings.clearDatabase')}</p>
                  <p className='text-xs text-[var(--juhe-text-3)]'>{t('settings.clearDatabaseDesc')}</p>
                </div>
                <button
                  type='button'
                  onClick={handleClearDatabase}
                  disabled={clearingDb}
                  className='px-3 py-1.5 rounded-lg text-sm bg-[var(--juhe-surface-2)] hover:bg-red-600/20 hover:text-red-500 border border-[var(--juhe-border)] transition-colors flex items-center gap-1.5 disabled:opacity-50 ml-3 shrink-0'
                >
                  {clearingDb ? (
                    <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                  ) : dbCleared ? (
                    <CheckCircle className='w-3.5 h-3.5 text-[var(--juhe-emerald)]' />
                  ) : (
                    <Trash2 className='w-3.5 h-3.5' />
                  )}
                  {clearingDb
                    ? t('settings.clearing')
                    : dbCleared
                      ? t('settings.cleared')
                      : t('settings.clearDatabase')}
                </button>
              </div>
            </div>
          </section>

          {/* Support */}
          <section className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
            <h2 className='text-lg font-semibold mb-4'>{t('settings.support')}</h2>
            <button
              type='button'
              onClick={() => setFeedbackOpen(true)}
              className='flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                         bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white
                         hover:opacity-90 transition-opacity'
            >
              <MessageSquare className='w-4 h-4' />
              {t('feedback.sendFeedback')}
            </button>
          </section>

          {/* Auto Update */}
          <section className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
            <h2 className='text-lg font-semibold mb-4'>{t('settings.autoUpdate')}</h2>
            <div className='flex items-center justify-between'>
              <div className='text-sm text-[var(--juhe-text-3)]'>
                {updateStatus === 'idle' && t('settings.checkUpdate')}
                {updateStatus === 'checking' && (
                  <span className='flex items-center gap-2'>
                    <RefreshCw className='w-4 h-4 animate-spin' />
                    {t('common.loading')}
                  </span>
                )}
                {updateStatus === 'available' && (
                  <span className='flex items-center gap-2 text-[var(--juhe-cyan)]'>
                    <CheckCircle className='w-4 h-4' />
                    {t('settings.newVersionAvailable', { version: updateInfo.version })}
                  </span>
                )}
                {updateStatus === 'not-available' && t('settings.upToDate')}
                {updateStatus === 'downloading' && (
                  <span className='flex items-center gap-2'>
                    <RefreshCw className='w-4 h-4 animate-spin' />
                    {t('settings.downloadingUpdate', { percent: Math.round(updateInfo.percent || 0) })}
                  </span>
                )}
                {updateStatus === 'downloaded' && (
                  <span className='flex items-center gap-2 text-[var(--juhe-emerald)]'>
                    <CheckCircle className='w-4 h-4' />
                    {t('settings.newVersionAvailable', { version: updateInfo.version })}
                  </span>
                )}
                {updateStatus === 'error' && (
                  <span className='flex items-center gap-2 text-[var(--juhe-magenta)]'>
                    <AlertCircle className='w-4 h-4' />
                    {updateInfo.message || t('settings.updateCheckFailed')}
                  </span>
                )}
              </div>
              <div className='flex gap-2'>
                {updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error' ? (
                  <button
                    type='button'
                    onClick={handleCheckUpdate}
                    className='px-3 py-1.5 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
                  >
                    {t('settings.checkUpdate')}
                  </button>
                ) : updateStatus === 'available' ? (
                  <button
                    type='button'
                    onClick={handleDownload}
                    className='px-3 py-1.5 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors flex items-center gap-1'
                  >
                    <Download className='w-4 h-4' />
                    {t('settings.downloadUpdate')}
                  </button>
                ) : updateStatus === 'downloaded' ? (
                  <button
                    type='button'
                    onClick={handleInstall}
                    className='px-3 py-1.5 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 transition-colors'
                  >
                    {t('settings.installUpdate')}
                  </button>
                ) : null}
              </div>
            </div>
            {updateStatus === 'downloading' && (
              <div className='mt-3 h-2 bg-[var(--juhe-void-3)] rounded-full overflow-hidden'>
                <div
                  className='h-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] transition-all duration-300'
                  style={{ width: `${updateInfo.percent || 0}%` }}
                />
              </div>
            )}
          </section>

          {/* Crash Reporting */}
          <CrashReportingSection />
        </div>
      )}

      {activeTab === 'providers' && (
        <div className='h-[calc(100vh-16rem)]'>
          <ProviderManager isOnboarding={isOnboarding} />
        </div>
      )}
      {activeTab === 'loadbalance' && (
        <div className='h-[calc(100vh-12rem)] overflow-y-auto pr-2'>
          <LoadBalancePanel />
        </div>
      )}
      {activeTab === 'lora' && (
        <div className='h-[calc(100vh-12rem)]'>
          <LoraManager />
        </div>
      )}
      {activeTab === 'shortcuts' && <ShortcutsSettings />}
      {activeTab === 'mcp' && (
        <section className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
          <McpSettings />
        </section>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={t('settings.clearDatabaseWarning')}
        description={t('settings.clearDatabaseWarning')}
        confirmText={t('common.confirm') as string}
        cancelText={t('common.cancel') as string}
        danger
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  )
}

function CrashReportingSection() {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(true)
  const [showRestartNotice, setShowRestartNotice] = useState(false)

  useEffect(() => {
    window.api.system
      ?.getCrashReporting()
      .then((val: boolean) => {
        setEnabled(val)
      })
      .catch(() => {})
  }, [])

  const handleToggle = async (newValue: boolean) => {
    setEnabled(newValue)
    try {
      await window.api.system?.setCrashReporting(newValue)
      if (!newValue) {
        setShowRestartNotice(false)
      } else {
        setShowRestartNotice(true)
      }
    } catch (err) {
      console.error('[CrashReporting] Failed to save:', err)
    }
  }

  return (
    <section className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
      <h2 className='text-lg font-semibold mb-4'>{t('settings.crashReporting')}</h2>
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-sm font-medium'>{t('settings.sendCrashReports')}</p>
          <p className='text-xs text-[var(--juhe-text-3)] mt-1'>{t('settings.crashReportingDesc')}</p>
        </div>
        <button
          type='button'
          onClick={() => handleToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]' : 'bg-[var(--juhe-surface-2)]'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      {showRestartNotice && (
        <div className='mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--juhe-cyan)]/10 border border-[var(--juhe-cyan)]/20'>
          <AlertCircle className='w-4 h-4 text-[var(--juhe-cyan)] shrink-0' />
          <p className='text-xs text-[var(--juhe-text-3)]'>{t('settings.crashReportingRestartNotice')}</p>
        </div>
      )}
    </section>
  )
}

function ShortcutsSettings() {
  const { t } = useTranslation()
  const {
    shortcuts,
    isRecording,
    recordingFor,
    resetToDefault,
    resetAll,
    toggleEnabled,
    startRecording,
    stopRecording
  } = useShortcutsStore()
  const [search, setSearch] = useState('')

  const filtered = shortcuts.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.currentKey.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = (['navigation', 'generation', 'chat', 'global'] as const).map((cat) => ({
    category: cat,
    items: filtered.filter((s) => s.category === cat)
  }))

  const categoryLabels: Record<string, string> = {
    navigation: t('shortcuts.categoryNavigation'),
    generation: t('shortcuts.categoryGeneration'),
    chat: t('shortcuts.categoryChat'),
    global: t('shortcuts.categoryGlobal')
  }

  return (
    <div className='max-w-3xl space-y-6'>
      {/* Search + Reset All */}
      <div className='flex items-center gap-3'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--juhe-text-3)]' />
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('shortcuts.searchShortcuts')}
            className='w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                       focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
          />
        </div>
        <button
          type='button'
          onClick={resetAll}
          className='flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[var(--juhe-void-3)] hover:bg-[var(--juhe-void-3)]/80 transition-colors'
        >
          <RotateCcw className='w-3.5 h-3.5' />
          {t('shortcuts.resetAll')}
        </button>
      </div>

      {filtered.length === 0 && (
        <div className='text-center py-12 text-[var(--juhe-text-3)] text-sm'>{t('shortcuts.noResults')}</div>
      )}

      {grouped.map(
        (group) =>
          group.items.length > 0 && (
            <section
              key={group.category}
              className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'
            >
              <h2 className='text-sm font-semibold uppercase tracking-wider text-[var(--juhe-text-3)] mb-4'>
                {categoryLabels[group.category]}
              </h2>
              <div className='space-y-3'>
                {group.items.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                      s.isEnabled ? 'bg-[var(--juhe-void-3)]/40' : 'bg-[var(--juhe-void-3)]/20 opacity-60'
                    }`}
                  >
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-medium'>{s.name}</p>
                        {!s.isEnabled && (
                          <span className='text-[10px] px-1.5 py-0.5 rounded bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)]'>
                            {t('shortcuts.disabled')}
                          </span>
                        )}
                      </div>
                      <p className='text-xs text-[var(--juhe-text-3)]'>{s.description}</p>
                    </div>

                    <div className='flex items-center gap-2 ml-4 shrink-0'>
                      {isRecording && recordingFor === s.id ? (
                        <span className='flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)] animate-pulse'>
                          <Command className='w-3 h-3' />
                          {t('shortcuts.pressKey')}
                        </span>
                      ) : (
                        <kbd className='px-2 py-1 text-xs font-mono bg-[var(--juhe-void-2)] border border-[var(--juhe-border)] rounded-md shadow-sm'>
                          {s.currentKey}
                        </kbd>
                      )}

                      <button
                        type='button'
                        onClick={() => (isRecording && recordingFor === s.id ? stopRecording() : startRecording(s.id))}
                        className={`p-1.5 rounded-md transition-colors ${
                          isRecording && recordingFor === s.id
                            ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                            : 'hover:bg-[var(--juhe-void-3)]'
                        }`}
                        title={t('shortcuts.edit')}
                      >
                        {isRecording && recordingFor === s.id ? (
                          <Check className='w-3.5 h-3.5' />
                        ) : (
                          <Keyboard className='w-3.5 h-3.5' />
                        )}
                      </button>

                      <button
                        type='button'
                        onClick={() => resetToDefault(s.id)}
                        className='p-1.5 rounded-md hover:bg-[var(--juhe-void-3)] transition-colors'
                        title={t('shortcuts.reset')}
                      >
                        <RotateCcw className='w-3.5 h-3.5' />
                      </button>

                      <button
                        type='button'
                        onClick={() => toggleEnabled(s.id)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          s.isEnabled
                            ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]'
                            : 'bg-[var(--juhe-surface-2)]'
                        }`}
                        title={s.isEnabled ? t('shortcuts.enabled') : t('shortcuts.disabled')}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            s.isEnabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
      )}
    </div>
  )
}
