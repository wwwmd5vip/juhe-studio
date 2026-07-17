import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Image as ImageIcon, AlertCircle } from 'lucide-react'
import {
  useProjectDeliverables,
  useImageModels,
  useSubmitProductSet,
  useRetryProductSet,
  useCancelProductSet
} from '@/hooks/useCreatorOs'
import type { DbModel } from '@shared/types/provider'

interface ProductSetPanelProps {
  projectId: string
  isRunning: boolean
}

const SLOT_COUNT = 8

const SLOT_LABEL_KEYS = [
  'creator-os.slot-main', 'creator-os.slot-detail-1',
  'creator-os.slot-detail-2', 'creator-os.slot-scene',
  'creator-os.slot-color-1', 'creator-os.slot-color-2',
  'creator-os.slot-size', 'creator-os.slot-packaging'
] as const

export function ProductSetPanel({ projectId, isRunning }: ProductSetPanelProps) {
  const { t } = useTranslation()
  const [slotModels, setSlotModels] = useState<Record<number, string>>({})
  const [slotPrompts, setSlotPrompts] = useState<Record<number, string>>({})

  const slotLabels = SLOT_LABEL_KEYS.map((k) => t(k))

  const { data: deliverables = [] } = useProjectDeliverables(projectId, { refetchInterval: 3000 })
  const { data: models = [], isLoading: modelsLoading } = useImageModels()

  const submitMutation = useSubmitProductSet(projectId)
  const retryMutation = useRetryProductSet(projectId)
  const cancelMutation = useCancelProductSet(projectId)

  const hasImageModel = models.length > 0

  const handleSubmit = () => {
    if (!hasImageModel) {
      submitMutation.mutate({})
      return
    }

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
    submitMutation.mutate(slotParams)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Model availability banner */}
      {!modelsLoading && !hasImageModel && (
        <div className="m-6 mb-0 p-4 rounded-cos-md bg-cos-error/10 border border-cos-error/30
                        flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-cos-error shrink-0 mt-0.5" />
          <div>
            <p className="text-cos-error text-sm font-medium">没有可用的图片模型</p>
            <p className="text-cos-error/80 text-xs mt-1">
              请先在「设置 → Provider/模型」中添加 image 模型，或登录 Juhe Management 同步模型。
            </p>
          </div>
        </div>
      )}

      {/* 8-slot grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-4 gap-4 mb-8">
          {Array.from({ length: SLOT_COUNT }).map((_, i) => {
            const del = deliverables.find((d: any) => d.slotIndex === i)
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
                <div className="aspect-square relative bg-cos-bg-alt">
                  {isOk ? (
                    <img
                      src={`juhe-image://${del.versionFilePath}`}
                      alt={slotLabels[i]}
                      className="w-full h-full object-cover"
                      onError={(e: any) => { e.target.style.display = 'none' }}
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
                  {isOk && (
                    <div className="absolute top-2 left-2 bg-cos-success/90 text-white
                                    text-[10px] px-1.5 py-0.5 rounded-cos-sm">✓</div>
                  )}
                </div>

                <div className="px-2 pt-2">
                  <textarea
                    value={slotPrompts[i] ?? ''}
                    onChange={(e) => setSlotPrompts((prev) => ({ ...prev, [i]: e.target.value }))}
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

                <div className="px-2 pt-1">
                  <select
                    value={slotModels[i] || ''}
                    onChange={(e) => setSlotModels((prev) => ({ ...prev, [i]: e.target.value }))}
                    disabled={isRunning || modelsLoading}
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

                {isFailed && del && (
                  <div className="px-2 pt-1 pb-2">
                    <button
                      onClick={() => retryMutation.mutate([del.taskId])}
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

                {!isFailed && <div className="pb-2" />}
              </div>
            )
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-center gap-4">
            <button
              onClick={handleSubmit}
              disabled={isRunning || modelsLoading}
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
            <p className="text-cos-error text-sm text-center">
              {submitMutation.error instanceof Error
                ? submitMutation.error.message
                : String(submitMutation.error)}
            </p>
          )}
          {retryMutation.isError && (
            <p className="text-cos-error text-sm text-center">
              {retryMutation.error instanceof Error
                ? retryMutation.error.message
                : String(retryMutation.error)}
            </p>
          )}
          {cancelMutation.isError && (
            <p className="text-cos-error text-sm text-center">
              {cancelMutation.error instanceof Error
                ? cancelMutation.error.message
                : String(cancelMutation.error)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
