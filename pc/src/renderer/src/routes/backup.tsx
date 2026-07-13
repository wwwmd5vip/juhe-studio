import { createFileRoute } from '@tanstack/react-router'
import {
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FileJson,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'
import { error as toastError, success as toastSuccess } from '@/components/ui/toast'
import { type BackupCategory, type BackupItem, useBackupStore } from '@/stores/backup'

export const Route = createFileRoute('/backup')({
  component: BackupPage
})

const ALL_CATEGORIES: BackupCategory[] = [
  'settings',
  'providers',
  'history',
  'favorites',
  'workflows',
  'agents',
  'shortcuts'
]

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

function BackupPage() {
  const { t } = useTranslation()
  const { backups, isBackingUp, isRestoring, createBackup, restoreBackup, deleteBackup, exportBackup, importBackup } =
    useBackupStore()

  const [backupName, setBackupName] = useState('')
  const [backupDesc, setBackupDesc] = useState('')
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<BackupCategory[]>([
    'settings',
    'favorites',
    'agents',
    'shortcuts'
  ])
  const [isDragging, setIsDragging] = useState(false)
  const [_previewBackup, _setPreviewBackup] = useState<{
    item: BackupItem
    data: unknown
  } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDbBackingUp, setIsDbBackingUp] = useState(false)
  const [isDbRestoring, setIsDbRestoring] = useState(false)
  const [dbBackups, setDbBackups] = useState<{ name: string; path: string; size: number; createdAt: number }[]>([])
  const [dbBackupResult, setDbBackupResult] = useState<string | null>(null)
  const dbFileInputRef = useRef<HTMLInputElement>(null)

  const handleFullDbBackup = async () => {
    setIsDbBackingUp(true)
    setDbBackupResult(null)
    try {
      const result = await window.api.system.backupDatabase()
      if (result.success) {
        setDbBackupResult(`Backup saved: ${result.path} (${formatBytes(result.size as number)})`)
        // Refresh backup list
        const list = await window.api.system.listBackups()
        setDbBackups(list)
      } else {
        setDbBackupResult(`Backup failed: ${result.error}`)
      }
    } catch (e) {
      setDbBackupResult(`Backup error: ${String(e)}`)
    } finally {
      setIsDbBackingUp(false)
    }
  }

  const handleDbRestore = async () => {
    dbFileInputRef.current?.click()
  }

  const handleDbFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsDbRestoring(true)
    try {
      // We need the actual file path for Node.js fs access, but in Electron renderer
      // we can use the file's path property (available via Electron's File API)
      const filePath = (file as File & { path?: string }).path
      if (!filePath) {
        // Fallback: read file content and write to temp location via a new IPC
        toastError({ description: 'Cannot determine file path. Please use drag & drop from Finder/Explorer.' })
        setIsDbRestoring(false)
        return
      }
      const result = await window.api.system.restoreDatabase(filePath)
      if (result.success) {
        toastSuccess({
          description: `Database restored successfully! ${result.restored} rows imported. App will now reload.`
        })
        window.location.reload()
      } else {
        toastError({ description: `Restore failed: ${result.error}` })
      }
    } catch (e) {
      toastError({ description: `Restore error: ${String(e)}` })
    } finally {
      setIsDbRestoring(false)
      e.target.value = ''
    }
  }

  const loadDbBackups = async () => {
    try {
      const list = await window.api.system.listBackups()
      setDbBackups(list)
    } catch {
      // ignore
    }
  }

  const toggleCategory = (cat: BackupCategory) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
  }

  const handleCreate = async () => {
    if (!backupName.trim() || selectedCategories.length === 0) return
    await createBackup(backupName.trim(), selectedCategories)
    setBackupName('')
    setBackupDesc('')
  }

  const handleRestore = async (id: string) => {
    setRestoreTargetId(id)
  }

  const handleDelete = (id: string) => {
    setDeleteTargetId(id)
  }

  const handleExport = async (id: string) => {
    await exportBackup(id)
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      const text = await file.text()
      await importBackup(text)
    },
    [importBackup]
  )

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    await importBackup(text)
    e.target.value = ''
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className='p-8 h-full overflow-y-auto' style={{ background: 'var(--juhe-void)' }}>
      <div className='max-w-4xl mx-auto space-y-8'>
        {/* Header */}
        <div className='flex items-center gap-3'>
          <Database className='w-6 h-6 text-[var(--juhe-cyan)]' />
          <h1 className='text-2xl font-bold'>{t('backup.title')}</h1>
        </div>

        {/* Create Backup */}
        <section className='p-5 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] space-y-4'>
          <div className='flex items-center gap-2'>
            <Archive className='w-5 h-5 text-[var(--juhe-text-3)]' />
            <h2 className='text-lg font-semibold'>{t('backup.createBackup')}</h2>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>{t('backup.backupName')}</label>
              <input
                type='text'
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder={t('backup.backupName')}
                className='w-full px-3 py-2 rounded-lg bg-[var(--juhe-void-2)] border border-[var(--juhe-border)] text-sm placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
              />
            </div>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>{t('backup.backupDesc')}</label>
              <input
                type='text'
                value={backupDesc}
                onChange={(e) => setBackupDesc(e.target.value)}
                placeholder={t('backup.backupDesc')}
                className='w-full px-3 py-2 rounded-lg bg-[var(--juhe-void-2)] border border-[var(--juhe-border)] text-sm placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
              />
            </div>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>{t('backup.include')}</label>
            <div className='flex flex-wrap gap-2'>
              {ALL_CATEGORIES.map((cat) => (
                <button
                  type='button'
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    selectedCategories.includes(cat)
                      ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 border-[var(--juhe-cyan)] text-[var(--juhe-cyan)]'
                      : 'bg-[var(--juhe-void-3)] border-transparent text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)]'
                  }`}
                >
                  {selectedCategories.includes(cat) && <Check className='w-3.5 h-3.5' />}
                  {t(`backup.${cat}`)}
                </button>
              ))}
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleCreate}
              disabled={!backupName.trim() || selectedCategories.length === 0 || isBackingUp}
              className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 disabled:opacity-50 transition-colors'
            >
              {isBackingUp ? <RotateCcw className='w-4 h-4 animate-spin' /> : <Archive className='w-4 h-4' />}
              {t('backup.create')}
            </button>
          </div>
        </section>

        {/* Import Backup */}
        <section className='p-5 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] space-y-4'>
          <div className='flex items-center gap-2'>
            <Upload className='w-5 h-5 text-[var(--juhe-text-3)]' />
            <h2 className='text-lg font-semibold'>{t('backup.import')}</h2>
          </div>

          {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
<div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 py-10 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              isDragging
                ? 'border-[var(--juhe-cyan)] bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/5'
                : 'border-[var(--juhe-border)] bg-[var(--juhe-void-2)] hover:border-muted-foreground/30'
            }`}
          >
            <FileJson className='w-8 h-8 text-[var(--juhe-text-3)]' />
            <p className='text-sm text-[var(--juhe-text-3)]'>{t('backup.dropFile')}</p>
            <p className='text-xs text-[var(--juhe-text-3)]'>{t('backup.selectFile')}</p>
            <input
              ref={fileInputRef}
              type='file'
              accept='.json,application/json'
              onChange={handleFileSelect}
              className='hidden'
            />
          </div>
        </section>

        {/* Full Database Backup */}
        <section className='p-5 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] space-y-4'>
          <div className='flex items-center gap-2'>
            <HardDrive className='w-5 h-5 text-[var(--juhe-cyan)]' />
            <h2 className='text-lg font-semibold'>{t('backup.fullDbBackup')}</h2>
          </div>

          <p className='text-sm text-[var(--juhe-text-3)]'>
            Export all database tables (generations, workflows, chat messages, providers, etc.) as a complete JSON
            backup. This backs up the full SQLite database, not just Zustand store state.
          </p>

          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleFullDbBackup}
              disabled={isDbBackingUp}
              className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90 disabled:opacity-50 transition-colors'
            >
              {isDbBackingUp ? <Loader2 className='w-4 h-4 animate-spin' /> : <HardDrive className='w-4 h-4' />}
              {isDbBackingUp ? t('backup.dbBackingUp') : t('backup.fullDbBackup')}
            </button>
            <button
              type='button'
              onClick={handleDbRestore}
              disabled={isDbRestoring}
              className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-[var(--juhe-border)] text-[var(--juhe-text-2)] hover:text-[var(--juhe-text)] hover:border-[var(--juhe-cyan)] disabled:opacity-50 transition-colors'
            >
              {isDbRestoring ? <Loader2 className='w-4 h-4 animate-spin' /> : <RefreshCw className='w-4 h-4' />}
              {isDbRestoring ? 'Restoring...' : 'Restore Backup'}
            </button>
            <input
              ref={dbFileInputRef}
              type='file'
              accept='.json,application/json'
              onChange={handleDbFileSelect}
              className='hidden'
            />
            <button
              type='button'
              onClick={loadDbBackups}
              className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--juhe-text-3)] hover:text-[var(--juhe-cyan)] transition-colors'
            >
              <FolderOpen className='w-4 h-4' />
              Refresh
            </button>
          </div>

          {dbBackupResult && (
            <div
              className={`text-sm p-2 rounded-lg ${dbBackupResult.includes('failed') || dbBackupResult.includes('error') ? 'bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]' : 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)]'}`}
            >
              {dbBackupResult}
            </div>
          )}

          {dbBackups.length > 0 && (
            <div className='space-y-1.5 mt-2'>
              <p className='text-xs text-[var(--juhe-text-3)]'>Recent backups:</p>
              {dbBackups.slice(0, 5).map((b) => (
                <div
                  key={b.path}
                  className='flex items-center justify-between text-xs text-[var(--juhe-text-2)] py-1 px-2 rounded bg-[var(--juhe-void-2)]'
                >
                  <span className='truncate'>{b.name}</span>
                  <span className='shrink-0 ml-2 text-[var(--juhe-text-3)]'>
                    {formatBytes(b.size)} · {formatDate(b.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Backup List */}
        <section className='space-y-3'>
          <div className='flex items-center gap-2'>
            <FolderOpen className='w-5 h-5 text-[var(--juhe-text-3)]' />
            <h2 className='text-lg font-semibold'>{t('backup.backupList')}</h2>
          </div>

          {backups.length === 0 ? (
            <div className='text-center py-12 text-[var(--juhe-text-3)] text-sm border border-dashed border-[var(--juhe-border)] rounded-xl'>
              {t('backup.noBackups')}
            </div>
          ) : (
            <div className='space-y-2'>
              {backups.map((backup) => {
                const isExpanded = expandedId === backup.id
                return (
                  <div
                    key={backup.id}
                    className='p-4 rounded-xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] transition-colors'
                  >
                    <div className='flex items-center justify-between gap-4'>
                      <div className='flex items-center gap-3 min-w-0'>
                        <div className='w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)] flex items-center justify-center shrink-0'>
                          <Database className='w-4 h-4' />
                        </div>
                        <div className='min-w-0'>
                          <p className='text-sm font-medium truncate'>{backup.name}</p>
                          <p className='text-xs text-[var(--juhe-text-3)]'>
                            {formatDate(backup.createdAt)} · {formatBytes(backup.size)}
                          </p>
                        </div>
                      </div>

                      <div className='flex items-center gap-1 shrink-0'>
                        <button
                          type='button'
                          onClick={() => handleRestore(backup.id)}
                          disabled={isRestoring}
                          className='p-2 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-cyan)] hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 transition-colors'
                          title={t('backup.restore')}
                        >
                          <RotateCcw className='w-4 h-4' />
                        </button>
                        <button
                          type='button'
                          onClick={() => handleExport(backup.id)}
                          className='p-2 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-cyan)] hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 transition-colors'
                          title={t('backup.export')}
                        >
                          <Download className='w-4 h-4' />
                        </button>
                        <button
                          type='button'
                          onClick={() => toggleExpand(backup.id)}
                          className='p-2 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-white/[0.03] transition-colors'
                          title={t('backup.preview')}
                        >
                          {isExpanded ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
                        </button>
                        <button
                          type='button'
                          onClick={() => handleDelete(backup.id)}
                          className='p-2 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-magenta)] hover:bg-[var(--juhe-magenta)]/10 transition-colors'
                          title={t('backup.delete')}
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className='mt-3 pt-3 border-t border-[var(--juhe-border)]'>
                        <div className='flex flex-wrap gap-1.5'>
                          {backup.includes.map((cat) => (
                            <span
                              key={cat}
                              className='px-2 py-0.5 rounded-md bg-[var(--juhe-void-3)] text-[var(--juhe-text-2)] text-xs'
                            >
                              {t(`backup.${cat}`)}
                            </span>
                          ))}
                        </div>
                        {backup.description && (
                          <p className='mt-2 text-xs text-[var(--juhe-text-3)]'>{backup.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
      <ConfirmModal
        open={restoreTargetId !== null}
        title={t('backup.restore') as string}
        description={t('backup.confirmRestore') as string}
        confirmText={t('backup.restore') as string}
        cancelText={t('common.cancel') as string}
        onConfirm={async () => {
          if (restoreTargetId) {
            await restoreBackup(restoreTargetId)
          }
          setRestoreTargetId(null)
        }}
        onCancel={() => setRestoreTargetId(null)}
      />

      <ConfirmModal
        open={deleteTargetId !== null}
        title={t('common.delete') as string}
        description={t('backup.confirmDelete') as string}
        confirmText={t('common.delete') as string}
        cancelText={t('common.cancel') as string}
        danger
        onConfirm={() => {
          if (deleteTargetId) {
            deleteBackup(deleteTargetId)
          }
          setDeleteTargetId(null)
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  )
}
