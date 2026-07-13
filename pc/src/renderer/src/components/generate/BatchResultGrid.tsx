import type { GenerationTask } from '@shared/types/generation'
import { AlertCircle, ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function getGridClass(n: number): string {
  if (n <= 2) return 'grid-cols-2'
  if (n <= 4) return 'grid-cols-2'
  if (n <= 6) return 'grid-cols-3'
  return 'grid-cols-3'
}

function getOutputForSlot(task: GenerationTask, slotIndex: number) {
  return task.outputs[slotIndex]
}

function getImageUrl(output: GenerationTask['outputs'][0]): string | null {
  if (output?.url) return output.url
  if (output?.base64 && output?.mediaType) return `data:${output.mediaType};base64,${output.base64}`
  return null
}

interface BatchResultGridProps {
  task: GenerationTask
}

export function BatchResultGrid({ task }: BatchResultGridProps) {
  const { t } = useTranslation()
  const n = task.params.n ?? 1
  const isDone = task.status === 'completed' || task.status === 'failed'
  const isFailed = task.status === 'failed'

  return (
    <div className='mb-4 p-4 rounded-xl glass-card border border-[var(--juhe-border)]'>
      <div className='flex items-center gap-2 mb-3'>
        <div
          className={`w-2 h-2 rounded-full ${isFailed ? 'bg-[var(--juhe-magenta)]' : 'bg-[var(--juhe-cyan)] animate-pulse'}`}
          style={{ boxShadow: isFailed ? undefined : '0 0 8px var(--juhe-cyan)' }}
        />
        <span
          className='text-xs font-medium uppercase tracking-wider text-[var(--juhe-cyan)]'
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {task.stage}
        </span>
        <span className='text-[10px] text-[var(--juhe-text-3)] ml-auto' style={{ fontFamily: 'var(--font-mono)' }}>
          {task.progress}%
        </span>
      </div>

      <div className={`grid ${getGridClass(n)} gap-2`}>
        {Array.from({ length: n }).map((_, slotIndex) => {
          const output = isDone ? getOutputForSlot(task, slotIndex) : undefined
          const imageUrl = output ? getImageUrl(output) : null
          const isVideo = output?.type === 'video'

          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
              key={slotIndex}
              className='relative aspect-square rounded-lg overflow-hidden border border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]'
            >
              {imageUrl ? (
                isVideo ? (
                  <video src={imageUrl} className='w-full h-full object-cover' controls preload='metadata'>
                    <track kind='captions' label='English' />
                  </video>
                ) : (
                  <img
                    src={imageUrl}
                    alt={t('generate.resultGallery.generated')}
                    className='w-full h-full object-cover'
                    loading='lazy'
                    decoding='async'
                  />
                )
              ) : (
                <div className='absolute inset-0 flex flex-col items-center justify-center text-[var(--juhe-text-3)]'>
                  {isFailed ? (
                    <>
                      <AlertCircle className='w-6 h-6 mb-1 text-[var(--juhe-magenta)]' />
                      <span className='text-[10px]'>{t('common.error')}</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className='w-6 h-6 mb-1 opacity-50' />
                      <span className='text-[10px]'>{slotIndex + 1}</span>
                    </>
                  )}
                </div>
              )}

              <div className='absolute top-1.5 left-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] font-bold text-white'>
                {slotIndex + 1}
              </div>

              {!isDone && !isFailed && (
                <div className='absolute bottom-0 left-0 right-0 h-1 bg-[var(--juhe-surface)]'>
                  <div
                    className='h-full bg-gradient-to-r from-[var(--juhe-cyan)] to-[var(--juhe-violet)] transition-all duration-500'
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {task.error && <p className='mt-3 text-xs text-[var(--juhe-magenta)]'>{task.error}</p>}
    </div>
  )
}
