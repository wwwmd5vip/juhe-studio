import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Image as ImageIcon } from 'lucide-react'

interface ResultGridProps {
  projectId: string
}

export function ResultGrid({ projectId }: ResultGridProps) {
  const { t } = useTranslation()

  const { data: deliverables = [] } = useQuery({
    queryKey: ['creator-os', 'deliverables', projectId],
    queryFn: () => (window.api as any).creatorOs.listDeliverables(projectId),
    refetchInterval: 3000
  })

  const labels = [
    t('creator-os.slot-main'),
    t('creator-os.slot-detail-1'),
    t('creator-os.slot-detail-2'),
    t('creator-os.slot-scene'),
    t('creator-os.slot-color-1'),
    t('creator-os.slot-color-2'),
    t('creator-os.slot-size'),
    t('creator-os.slot-packaging')
  ]

  const completedCount = (deliverables as any[]).filter(
    (d: any) => d.versionFilePath
  ).length

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-cos-heading text-sm text-cos-ink-secondary">
          {t('creator-os.result-grid')}
          <span className="ml-2 text-cos-ink-muted text-xs">
            ({completedCount}/8)
          </span>
        </h3>
      </div>

      {deliverables.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-cos-ink-muted">
          <ImageIcon className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">{t('creator-os.no-projects')}</p>
          <p className="text-xs mt-1">{t('creator-os.no-projects-hint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => {
            const del = (deliverables as any[]).find((d: any) => d.slotIndex === i)
            const hasResult = del?.versionFilePath
            const isFailed = del?.taskRuntimeStatus === 'failed'
            const isPending =
              del?.taskRuntimeStatus === 'pending' ||
              del?.taskRuntimeStatus === 'submitting' ||
              del?.taskRuntimeStatus === 'processing'

            return (
              <div
                key={i}
                className="relative aspect-square bg-cos-bg-alt border border-cos-border
                           rounded-cos-md overflow-hidden group"
              >
                {hasResult ? (
                  <>
                    <img
                      src={`juhe-image://${del.versionFilePath}`}
                      alt={labels[i]}
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.style.display = 'none'
                      }}
                    />
                    {/* Completed badge */}
                    <div className="absolute top-2 left-2 bg-cos-success/90 text-white
                                    text-[10px] px-1.5 py-0.5 rounded-cos-sm">
                      ✓
                    </div>
                  </>
                ) : isPending ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className="text-cos-accent text-xl animate-pulse mb-1">●</span>
                    <span className="text-[10px] text-cos-ink-muted">
                      {labels[i]}
                    </span>
                  </div>
                ) : isFailed ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className="text-cos-error text-xl mb-1">✗</span>
                    <span className="text-[10px] text-cos-ink-muted">
                      {labels[i]}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <ImageIcon className="w-6 h-6 text-cos-ink-muted opacity-30 mb-1" />
                    <span className="text-[10px] text-cos-ink-muted">
                      {labels[i]}
                    </span>
                  </div>
                )}

                {/* Label overlay on hover */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t
                                from-cos-ink/70 to-transparent p-2 opacity-0
                                group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-[10px]">{labels[i]}</span>
                </div>

                {/* Select checkbox */}
                {hasResult && (
                  <div className="absolute top-2 right-2">
                    <input
                      type="checkbox"
                      checked={del?.isSelected ?? true}
                      onChange={() => {
                        (window.api as any).creatorOs.updateDeliverable(del.id, {
                          isSelected: !del.isSelected
                        })
                      }}
                      className="w-4 h-4 rounded border-cos-border accent-cos-accent"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
