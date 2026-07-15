import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AssetPanel } from '@/components/creator-os/AssetPanel'
import { ResultGrid } from '@/components/creator-os/ResultGrid'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetail
})

function ProjectDetail() {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: project } = useQuery({
    queryKey: ['creator-os', 'projects', projectId],
    queryFn: () => (window.api as any).creatorOs.getProject(projectId)
  })

  const { data: assets = [] } = useQuery({
    queryKey: ['creator-os', 'assets', projectId],
    queryFn: () => (window.api as any).creatorOs.listAssets(projectId)
  })

  if (!project) {
    return <div className="p-12 text-center text-cos-ink-muted">Project not found</div>
  }

  const statusMap: Record<string, string> = {
    idle: 'Ready',
    submitting: 'Submitting...',
    processing: 'Generating...',
    completed: 'Done',
    partial: 'Partial results',
    failed: 'Failed'
  }

  return (
    <div className="h-full flex flex-col bg-cos-bg">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4
                      border-b border-cos-border bg-cos-surface">
        <div>
          <button
            onClick={() => navigate({ to: '/' })}
            className="text-cos-ink-muted hover:text-cos-ink text-sm"
          >
            ← {t('creator-os.back-to-projects')}
          </button>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-cos-heading text-xl text-cos-ink">
              {project.name}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cos-bg-alt
                             text-cos-ink-secondary">
              {statusMap[project.batchStatus || 'idle']}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: `/projects/${projectId}/product-set` })}
            className="bg-cos-accent hover:bg-cos-accent-hover text-white px-4 py-2
                       rounded-cos-md font-medium transition-colors"
          >
            {t('creator-os.product-set')}
          </button>
        </div>
      </div>

      {/* Content: AssetPanel + ResultGrid */}
      <div className="flex-1 flex overflow-hidden">
        <AssetPanel projectId={projectId} assets={assets as any} />
        <ResultGrid projectId={projectId} />
      </div>
    </div>
  )
}
