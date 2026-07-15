import { useState } from 'react'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { QueueDrawer } from '@/components/creator-os/QueueDrawer'
import type { DbModel } from '@shared/types/provider'

export const Route = createFileRoute('/projects/$projectId/product-set')({
  component: ProductSetPage
})

function ProductSetPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/product-set' })
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Per-slot model selection (slotIndex → modelId)
  const [slotModels, setSlotModels] = useState<Record<number, string>>({})

  const { data: project } = useQuery({
    queryKey: ['creator-os', 'projects', projectId],
    queryFn: () => (window.api as any).creatorOs.getProject(projectId)
  })

  const { data: deliverables = [] } = useQuery({
    queryKey: ['creator-os', 'deliverables', projectId],
    queryFn: () => (window.api as any).creatorOs.listDeliverables(projectId)
  })

  const { data: models = [] } = useQuery<DbModel[]>({
    queryKey: ['db', 'models', 'image'],
    queryFn: () => (window.api as any).models.list({ type: 'image' }),
    staleTime: 60_000
  })

  const submitMutation = useMutation({
    mutationFn: () => {
      const slotParams: Record<string, { prompt: string; model?: string; providerId?: string }> = {}
      for (let i = 0; i < 8; i++) {
        const modelId = slotModels[i]
        if (modelId) {
          const m = models.find((x: DbModel) => x.id === modelId)
          slotParams[String(i)] = {
            prompt: slotLabels[i],
            model: m?.name,
            providerId: m?.providerId
          }
        } else {
          slotParams[String(i)] = { prompt: slotLabels[i] }
        }
      }
      return (window.api as any).creatorOs.submitProductSetWithParams(projectId, slotParams)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'projects', projectId] })
      queryClient.invalidateQueries({ queryKey: ['creator-os', 'deliverables', projectId] })
    }
  })

  const retryMutation = useMutation({
    mutationFn: (taskId: string) =>
      (window.api as any).creatorOs.retryProductSet(projectId, [taskId]),
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

  const slotLabels = [
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

      {/* 8-slot grid with model selectors and retry */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 8 }).map((_, i) => {
          const del = (deliverables as any[]).find((d: any) => d.slotIndex === i)
          const isOk = del?.versionFilePath
          const isFailed = del?.taskRuntimeStatus === 'failed'
          const isPending =
            del?.taskRuntimeStatus === 'pending' || del?.taskRuntimeStatus === 'submitting'

          return (
            <div
              key={i}
              className="bg-cos-bg-alt border border-cos-border rounded-cos-md
                         overflow-hidden flex flex-col relative"
            >
              {/* Slot preview area */}
              <div className="aspect-square flex flex-col items-center justify-center text-cos-ink-muted">
                <span className="text-xs font-cos-heading mb-1">{slotLabels[i]}</span>
                {isOk ? (
                  <span className="text-cos-success text-lg">✓</span>
                ) : isPending ? (
                  <span className="text-cos-accent text-lg animate-pulse">●</span>
                ) : isFailed ? (
                  <span className="text-cos-error text-lg">✗</span>
                ) : (
                  <span className="text-cos-ink-muted text-lg">—</span>
                )}
              </div>

              {/* Retry button for failed slots */}
              {isFailed && del && (
                <div className="px-2 pb-1">
                  <button
                    onClick={() => retryMutation.mutate(del.taskId)}
                    disabled={retryMutation.isPending}
                    className="w-full flex items-center justify-center gap-1
                               text-cos-error hover:text-cos-error/80
                               text-xs py-1.5 rounded-cos-sm
                               border border-cos-error/30 hover:border-cos-error/50
                               transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t('creator-os.retry-slot')}
                  </button>
                </div>
              )}

              {/* Model selector per slot */}
              <div className="px-2 pb-2">
                <select
                  value={slotModels[i] || ''}
                  onChange={(e) =>
                    setSlotModels((prev) => ({
                      ...prev,
                      [i]: e.target.value
                    }))
                  }
                  disabled={isRunning}
                  className="w-full text-xs border border-cos-border rounded-cos-sm
                             bg-cos-surface text-cos-ink px-2 py-1.5
                             focus:outline-none focus:border-cos-accent
                             disabled:opacity-50 font-cos-body"
                >
                  <option value="">{t('creator-os.auto-model')}</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName || m.name}
                    </option>
                  ))}
                </select>
              </div>
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
            {t('creator-os.cancel-all')}
          </button>
        )}
      </div>

      {submitMutation.isError && (
        <p className="mt-4 text-cos-error text-sm text-center">
          {(submitMutation.error as Error).message}
        </p>
      )}
      {retryMutation.isError && (
        <p className="mt-2 text-cos-error text-sm text-center">
          {(retryMutation.error as Error).message}
        </p>
      )}

      <QueueDrawer />
    </div>
  )
}
