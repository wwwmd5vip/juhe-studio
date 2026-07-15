import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { QueueDrawer } from '@/components/creator-os/QueueDrawer'

export const Route = createFileRoute('/projects/$projectId/product-set')({
  component: ProductSetPage
})

function ProductSetPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/product-set' })
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['creator-os', 'projects', projectId],
    queryFn: () => (window.api as any).creatorOs.getProject(projectId)
  })

  const { data: deliverables = [] } = useQuery({
    queryKey: ['creator-os', 'deliverables', projectId],
    queryFn: () => (window.api as any).creatorOs.listDeliverables(projectId)
  })

  const submitMutation = useMutation({
    mutationFn: () =>
      (window.api as any).creatorOs.submitProductSet(projectId, 'standard-8'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects', projectId] })
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'deliverables', projectId] })
    }
  })

  const cancelMutation = useMutation({
    mutationFn: () =>
      (window.api as any).creatorOs.cancelProductSet(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects', projectId] })
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'deliverables', projectId] })
    }
  })

  const isRunning = project?.batchStatus === 'processing' || project?.batchStatus === 'submitting'

  const labels = [
    t('creator-os.slot-main'), t('creator-os.slot-detail-1'),
    t('creator-os.slot-detail-2'), t('creator-os.slot-scene'),
    t('creator-os.slot-color-1'), t('creator-os.slot-color-2'),
    t('creator-os.slot-size'), t('creator-os.slot-packaging')
  ]

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <h1 className="font-cos-heading text-2xl text-cos-ink mb-2">
        {t('creator-os.product-set')}
      </h1>
      {project && (
        <p className="text-cos-ink-secondary mb-6">
          {project.name} · {project.batchStatus || 'idle'}
        </p>
      )}

      {/* 8-slot grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 8 }).map((_, i) => {
          const del = (deliverables as any[]).find((d: any) => d.slotIndex === i)
          return (
            <div
              key={i}
              className="aspect-square bg-cos-bg-alt border border-cos-border
                         rounded-cos-md flex flex-col items-center justify-center
                         text-cos-ink-muted"
            >
              <span className="text-xs font-cos-heading mb-1">{labels[i]}</span>
              {del ? (
                <span className="text-cos-success text-lg">✓</span>
              ) : (
                <span className="text-cos-ink-muted text-lg">—</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => submitMutation.mutate()}
          disabled={isRunning}
          className="bg-cos-accent hover:bg-cos-accent-hover text-white px-6 py-3
                     rounded-cos-md font-medium disabled:opacity-50 transition-colors"
        >
          {isRunning ? t('creator-os.generating') : t('creator-os.generate-all')}
        </button>
        {isRunning && (
          <button
            onClick={() => cancelMutation.mutate()}
            className="border border-cos-error text-cos-error px-6 py-3
                       rounded-cos-md font-medium hover:bg-cos-error hover:text-white transition-colors"
          >
            Cancel All
          </button>
        )}
      </div>

      {submitMutation.isError && (
        <p className="mt-4 text-cos-error text-sm text-center">
          {(submitMutation.error as Error).message}
        </p>
      )}

      <QueueDrawer />
    </div>
  )
}
