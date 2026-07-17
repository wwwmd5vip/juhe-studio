import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useProjects, useCreateProject } from '@/hooks/useCreatorOs'
import type { Project } from '@shared/types/creator-os'

interface ProjectCardProps {
  project: Project
}

function ProjectCard({ project }: ProjectCardProps) {
  const { t } = useTranslation()
  const router = useRouter()

  const getStatusBadge = (s: string): { label: string; className: string } => {
    const key = `creator-os.status-${s || 'idle'}`
    const base = 'text-xs px-2 py-0.5 rounded-full'
    switch (s) {
      case 'submitting':
      case 'processing':
        return { label: t(key as any), className: `${base} bg-cos-info text-white` }
      case 'completed':
        return { label: t(key as any), className: `${base} bg-cos-success text-white` }
      case 'partial':
        return { label: t(key as any), className: `${base} bg-cos-warning text-white` }
      case 'failed':
        return { label: t(key as any), className: `${base} bg-cos-error text-white` }
      default:
        return { label: t(key as any), className: `${base} bg-cos-accent-muted text-cos-ink` }
    }
  }

  const badge = getStatusBadge(project.batchStatus || 'idle')

  return (
    <div
      onClick={() => {
        console.log('[ProjectList] Navigating to project:', project.id)
        router.navigate({ to: '/projects/$projectId', params: { projectId: project.id } })
      }}
      className="block bg-cos-surface border border-cos-border rounded-cos-lg p-5
                 shadow-cos-card hover:shadow-cos-panel hover:border-cos-accent-muted
                 cursor-pointer transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-cos-heading text-cos-ink text-lg leading-snug">
          {project.name}
        </h3>
        <span className={badge.className}>{badge.label}</span>
      </div>
      {project.description && (
        <p className="text-cos-ink-secondary text-sm line-clamp-2 mb-3">
          {project.description}
        </p>
      )}
      <p className="text-cos-ink-muted text-xs">
        {new Date(project.updatedAt).toLocaleDateString()}
      </p>
    </div>
  )
}

export function ProjectList() {
  const { t } = useTranslation()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')

  const { data: projects = [], isLoading } = useProjects()
  const createMutation = useCreateProject()

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    createMutation.mutate(
      { name: trimmed, category: 'product_set' },
      {
        onSuccess: () => {
          setShowCreate(false)
          setName('')
        }
      }
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-cos-heading text-3xl text-cos-ink mb-2">
            {t('creator-os.projects')}
          </h1>
          <p className="text-cos-ink-secondary text-base">
            {t('creator-os.projects-subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-cos-accent hover:bg-cos-accent-hover text-white px-4 py-2 rounded-cos-md
                     font-medium transition-colors"
        >
          {t('creator-os.new-project')}
        </button>
      </div>

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-cos-surface rounded-cos-lg shadow-cos-overlay p-6 w-96">
            <h2 className="font-cos-heading text-lg text-cos-ink mb-4">
              {t('creator-os.new-project')}
            </h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setShowCreate(false)
                  setName('')
                }
              }}
              placeholder={t('creator-os.project-name-placeholder')}
              className="w-full border border-cos-border rounded-cos-md px-3 py-2
                         text-cos-ink font-cos-body focus:outline-none focus:border-cos-accent mb-4"
            />
            {createMutation.isError && (
              <p className="text-cos-error text-sm mb-3">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : String(createMutation.error)}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowCreate(false); setName('') }}
                className="text-cos-ink-secondary hover:text-cos-ink"
              >
                {t('creator-os.create-project-cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || createMutation.isPending}
                className="bg-cos-accent hover:bg-cos-accent-hover text-white px-4 py-2
                           rounded-cos-md disabled:opacity-50"
              >
                {createMutation.isPending
                  ? t('creator-os.export-exporting')
                  : t('creator-os.create-project-create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-cos-bg-alt rounded-cos-lg h-40 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-cos-ink-muted text-lg mb-2">{t('creator-os.no-projects')}</p>
          <p className="text-cos-ink-muted mb-6">{t('creator-os.no-projects-hint')}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-cos-accent hover:bg-cos-accent-hover text-white px-4 py-2 rounded-cos-md"
          >
            {t('creator-os.create-first')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  )
}
