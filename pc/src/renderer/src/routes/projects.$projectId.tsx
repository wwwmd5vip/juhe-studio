import { useState, useRef } from 'react'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AssetPanel } from '@/components/creator-os/AssetPanel'
import { ResultGrid } from '@/components/creator-os/ResultGrid'
import { ProductSetPanel } from '@/components/creator-os/ProductSetPanel'
import { QueueDrawer } from '@/components/creator-os/QueueDrawer'
import {
  useProject,
  useProjectAssets,
  useUpdateProject,
  useDeleteProject
} from '@/hooks/useCreatorOs'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetail
})

function ProjectDetail() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const { t } = useTranslation()

  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: project, isLoading } = useProject(projectId)
  const { data: assets = [] } = useProjectAssets(projectId)
  const updateMutation = useUpdateProject(projectId)
  const deleteMutation = useDeleteProject()

  if (isLoading || !project) {
    return (
      <div className="h-full flex items-center justify-center text-cos-ink-muted">
        {t('creator-os.loading-project')}
      </div>
    )
  }

  const isRunning = project.batchStatus === 'processing' || project.batchStatus === 'submitting'

  const getStatusLabel = (s: string): string => {
    const key = `creator-os.status-${s}` as const
    return t(key as any)
  }

  const startRename = () => {
    setNameValue(project.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitRename = () => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== project.name) {
      updateMutation.mutate({ name: trimmed }, { onSuccess: () => setEditing(false) })
    } else {
      setEditing(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-cos-bg">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4
                      border-b border-cos-border bg-cos-surface shrink-0">
        <div>
          <Link
            to="/projects"
            className="text-cos-ink-muted hover:text-cos-ink text-sm"
          >
            ← {t('creator-os.back-to-projects')}
          </Link>
          <div className="flex items-center gap-3 mt-1">
            {editing ? (
              <input
                ref={inputRef}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditing(false)
                }}
                className="font-cos-heading text-xl text-cos-ink bg-transparent border-b
                           border-cos-accent outline-none"
              />
            ) : (
              <h1
                className="font-cos-heading text-xl text-cos-ink cursor-pointer
                           hover:text-cos-accent transition-colors"
                onClick={startRename}
                title={t('creator-os.rename-project')}
              >
                {project.name}
              </h1>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-cos-bg-alt
                             text-cos-ink-secondary">
              {getStatusLabel(project.batchStatus || 'idle')}
            </span>
          </div>
          {updateMutation.isError && (
            <p className="text-cos-error text-xs mt-1">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : String(updateMutation.error)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-cos-error hover:text-cos-error/80 text-sm
                       transition-colors"
          >
            {t('creator-os.delete-project')}
          </button>
        </div>
      </div>

      {/* Content: AssetPanel + ProductSetPanel + ResultGrid */}
      <div className="flex-1 flex overflow-hidden">
        <AssetPanel projectId={projectId} assets={assets as any} />
        <ProductSetPanel projectId={projectId} isRunning={isRunning} />
        <ResultGrid projectId={projectId} />
      </div>

      <QueueDrawer />

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-cos-surface rounded-cos-lg shadow-cos-overlay p-6 w-80">
            <h2 className="font-cos-heading text-lg text-cos-ink mb-3">
              {t('creator-os.delete-confirm-title')}
            </h2>
            <p className="text-sm text-cos-ink-secondary mb-6">
              {t('creator-os.delete-confirm')}
            </p>
            {deleteMutation.isError && (
              <p className="text-cos-error text-sm mb-4">
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : String(deleteMutation.error)}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-cos-ink-secondary hover:text-cos-ink text-sm"
              >
                {t('creator-os.export-cancel')}
              </button>
              <button
                onClick={() =>
                  deleteMutation.mutate(projectId, {
                    onSuccess: () => setShowDeleteConfirm(false)
                  })
                }
                disabled={deleteMutation.isPending}
                className="bg-cos-error hover:bg-cos-error/80 text-white px-4 py-2
                           rounded-cos-md text-sm disabled:opacity-50"
              >
                {deleteMutation.isPending
                  ? t('creator-os.export-exporting')
                  : t('creator-os.delete-project')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
