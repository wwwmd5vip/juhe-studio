import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

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

  const { data: deliverables = [] } = useQuery({
    queryKey: ['creator-os', 'deliverables', projectId],
    queryFn: () => (window.api as any).creatorOs.listDeliverables(projectId)
  })

  if (!project) {
    return <div className="p-12 text-center text-cos-ink-muted">Project not found</div>
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
          <h1 className="font-cos-heading text-xl text-cos-ink mt-1">
            {project.name}
          </h1>
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

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Asset panel */}
        <div className="w-64 border-r border-cos-border bg-cos-surface p-4 overflow-y-auto">
          <h3 className="font-cos-heading text-sm text-cos-ink-secondary mb-3">
            {t('creator-os.asset-panel')} ({assets.length})
          </h3>
          <div className="space-y-2">
            {assets.map((a: any) => (
              <div
                key={a.id}
                className="bg-cos-bg-alt rounded-cos-sm p-2 text-xs text-cos-ink-secondary truncate"
              >
                {a.filePath.split('/').pop()}
              </div>
            ))}
            {assets.length === 0 && (
              <p className="text-xs text-cos-ink-muted">
                {t('creator-os.import-asset')}
              </p>
            )}
          </div>
        </div>

        {/* Result grid — 2×4 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h3 className="font-cos-heading text-sm text-cos-ink-secondary mb-4">
            {t('creator-os.result-grid')} ({deliverables.length}/8)
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => {
              const del = (deliverables as any[]).find((d: any) => d.slotIndex === i)
              const labels = [
                t('creator-os.slot-main'), t('creator-os.slot-detail-1'),
                t('creator-os.slot-detail-2'), t('creator-os.slot-scene'),
                t('creator-os.slot-color-1'), t('creator-os.slot-color-2'),
                t('creator-os.slot-size'), t('creator-os.slot-packaging')
              ]
              return (
                <div
                  key={i}
                  className="aspect-square bg-cos-bg-alt border border-cos-border
                             rounded-cos-md flex flex-col items-center justify-center
                             text-cos-ink-muted text-xs"
                >
                  <span className="font-cos-heading">{labels[i]}</span>
                  {del && <span className="text-cos-success mt-1">✓</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
