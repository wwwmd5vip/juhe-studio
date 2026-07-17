import { useState } from 'react'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Image as ImageIcon } from 'lucide-react'
import { QueueDrawer } from '@/components/creator-os/QueueDrawer'
import type { DbModel } from '@shared/types/provider'

export const Route = createFileRoute('/projects/$projectId/product-set')({
  component: ProductSetPage
})

const SLOT_COUNT = 8

const SLOT_LABEL_KEYS = [
  'creator-os.slot-main', 'creator-os.slot-detail-1',
  'creator-os.slot-detail-2', 'creator-os.slot-scene',
  'creator-os.slot-color-1', 'creator-os.slot-color-2',
  'creator-os.slot-size', 'creator-os.slot-packaging'
] as const

function ProductSetPage() {
  const { projectId } = useParams({ from: '/projects/$projectId/product-set' })
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [slotModels, setSlotModels] = useState<Record<number, string>>({})
  const [slotPrompts, setSlotPrompts] = useState<Record<number, string>>({})

  const slotLabels = SLOT_LABEL_KEYS.map((k) => t(k))

  const { data: project } = useQuery({
    queryKey: ['creator-os', 'projects', projectId],
    queryFn: () => (window.api as any).creatorOs.getProject(projectId)
  })

  const { data: deliverables = [] } = useQuery({
    queryKey: ['creator-os', 'deliverables', projectId],
    queryFn: () => (window.api as any).creatorOs.listDeliverables(projectId),
    refetchInterval: 3000
  })

  const { data: models = [] } = useQuery<DbModel[]>({
    queryKey: ['db', 'models', 'image'],
    queryFn: () => (window.api as any).db.models.list({ type: 'image' }),
    staleTime: 60_000
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const slotParams: Record<string, { prompt: string; model?: string; providerId?: string }> = {}
      for (let i = 0; i < SLOT_COUNT; i++) {
        const modelId = slotModels[i]
        const prompt = slotPrompts[i]?.trim() || slotLabels[i]
        if (modelId) {
          const m = models.find((x: DbModel) => x.id === modelId)
          slotParams[String(i)] = {
            prompt,
            model: m?.id,
            providerId: m?.providerId
          }
        } else {
          slotParams[String(i)] = { prompt }
        }
      }
      console.log('[ProductSet] Submitting with slotParams:', slotParams)
      const result = await (window.api as any).creatorOs.submitProductSetWithParams(projectId, slotParams)
      console.log('[ProductSet] Submit result:', result)
      if (!result?.ok) {
        throw new Error(result?.error || 'Submission failed')
      }
      return result
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

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <h1 className="font-cos-heading text-2xl text-cos-ink mb-2">
        {t('creator-os.product-set')}
      </h1>
      {project && (
        <p className="text-cos-ink-secondary mb-6">
          {project.name} · {project.batchStatus || 'idle'}
        </p>
      )}

      {/* 8-slot grid with prompts, model selectors, thumbnails, and retry */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {Array.from({ length: SLOT_COUNT }).map((_, i) => {
          const del = (deliverables as any[]).find((d: any) => d.slotIndex === i)
          const isOk = del?.versionFilePath
          const isFailed = del?.taskRuntimeStatus === 'failed'
          const isPending =
            del?.taskRuntimeStatus === 'pending' || del?.taskRuntimeStatus === 'submitting'

          return (
            <div
              key={i}
              className="bg-cos-bg-alt border border-cos-border rounded-cos-md
                         overflow-hidden flex flex-col"
            >
              {/* Slot preview: thumbnail or status icon */}
              <div className="aspect-square relative bg-cos-bg-alt">
                {isOk ? (
                  <img
                    src={`juhe-image://${del.versionFilePath}`}
                    alt={slotLabels[i]}
                    className="w-full h-full object-cover"
                    onError={(e: any) => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    {isPending ? (
                      <span className="text-cos-accent text-2xl animate-pulse">●</span>
                    ) : isFailed ? (
                      <span className="text-cos-error text-2xl">✗</span>
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-cos-ink-muted opacity-20 mb-2" />
                        <span className="text-[10px] text-cos-ink-muted">{slotLabels[i]}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Status overlay badge */}
                {isOk && (
                  <div className="absolute top-2 left-2 bg-cos-success/90 text-white
                                  text-[10px] px-1.5 py-0.5 rounded-cos-sm">
                    ✓
                  </div>
                )}
              </div>

              {/* Prompt input */}
              <div className="px-2 pt-2">
                <textarea
                  value={slotPrompts[i] ?? ''}
                  onChange={(e) =>
                    setSlotPrompts((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                  placeholder={`${t('creator-os.slot-prompt-placeholder')} (${slotLabels[i]})`}
                  disabled={isRunning}
                  rows={2}
                  className="w-full text-xs border border-cos-border rounded-cos-sm
                             bg-cos-surface text-cos-ink px-2 py-1
                             placeholder:text-cos-ink-muted
                             focus:outline-none focus:border-cos-accent
                             disabled:opacity-50 font-cos-body resize-none"
                />
              </div>

              {/* Model selector */}
              <div className="px-2 pt-1">
                <select
                  value={slotModels[i] || ''}
                  onChange={(e) =>
                    setSlotModels((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                  disabled={isRunning}
                  className="w-full text-xs border border-cos-border rounded-cos-sm
                             bg-cos-surface text-cos-ink px-2 py-1
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

              {/* Retry button for failed slots */}
              {isFailed && del && (
                <div className="px-2 pt-1 pb-2">
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

              {/* Spacer when no retry button */}
              {!isFailed && <div className="pb-2" />}
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
