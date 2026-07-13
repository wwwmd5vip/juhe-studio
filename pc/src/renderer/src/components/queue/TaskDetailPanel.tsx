import type { GenerationTask } from '@shared/types/generation'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ChevronDown, ChevronRight, Clock, FileText, Film, Image, Maximize2, Wand2 } from 'lucide-react'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { formatFullTime, formatDuration } from './utils'

/** 错误信息最大显示字符数，超出则折叠 */
const ERROR_PREVIEW_MAX = 180

function ImageOrVideo({ src, alt, type, onClick }: { src: string; alt: string; type?: string; onClick?: () => void }) {
  if (type === 'video') {
    return (
      <video src={src} className='w-full h-full object-cover cursor-pointer' controls preload='metadata' onClick={onClick}>
        <track kind='captions' label='English' />
      </video>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className='w-full h-full object-cover cursor-pointer'
      loading='lazy'
      onClick={onClick}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

function ReferenceImages({ images, title }: { images: string[]; title: string }) {
  return (
    <div className='space-y-0.5'>
      <div className='flex items-center gap-1.5 text-[11px] font-medium text-[var(--juhe-text-3)]'>
        <Image className='w-3 h-3' />
        {title} ({images.length})
      </div>
      <div className='flex gap-1.5 flex-wrap'>
        {images.map((img, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
            key={i}
            className='w-14 h-14 rounded-md overflow-hidden bg-[var(--juhe-void-3)] border border-[var(--juhe-border)]/50'
          >
            <img
              src={img.startsWith('data:') ? img : `data:image/png;base64,${img}`}
              alt={`${title} ${i + 1}`}
              className='w-full h-full object-cover'
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TaskDetailPanel({ task, onZoomImage }: { task: GenerationTask; onZoomImage?: (url: string) => void }) {
  const { t } = useTranslation()
  const p = task.params
  const [errorExpanded, setErrorExpanded] = useState(false)
  const errorTooLong = (task.error?.length ?? 0) > ERROR_PREVIEW_MAX

  const paramItems = [
    { label: 'Model', value: p.model },
    { label: 'Provider', value: p.providerId },
    { label: 'Size', value: p.size },
    { label: 'Aspect Ratio', value: p.aspectRatio },
    { label: 'Seed', value: p.seed?.toString() },
    { label: 'N', value: p.n?.toString() },
    { label: 'Quality', value: p.quality },
    { label: 'Style', value: p.style },
    { label: 'Duration', value: p.duration ? `${p.duration}s` : undefined },
    { label: 'FPS', value: p.fps?.toString() },
    { label: 'Negative Prompt', value: p.negativePrompt },
    { label: 'Camera Motion', value: p.cameraMotion },
    { label: 'Mode', value: p.mode },
    { label: 'Batch Count', value: p.batchCount?.toString() }
  ].filter((item) => item.value !== undefined && item.value !== null && item.value !== '')

  return (
    <div className='space-y-2.5'>
      {/* Prompt */}
      <div className='space-y-0.5'>
        <div className='flex items-center gap-1.5 text-[11px] font-medium text-[var(--juhe-text-3)]'>
          <FileText className='w-3 h-3' />Prompt
        </div>
        <p className='text-xs bg-[var(--juhe-void-2)] rounded-md p-2 border border-[var(--juhe-border)]/50 whitespace-pre-wrap break-words max-h-20 overflow-y-auto'>
          {p.prompt || t('queue.taskInfo.noPrompt')}
        </p>
      </div>

      {/* Parameters */}
      {paramItems.length > 0 && (
        <div className='space-y-0.5'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-[var(--juhe-text-3)]'>
            <Wand2 className='w-3 h-3' />Parameters
          </div>
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5'>
            {paramItems.map((item) => (
              <div key={item.label} className='bg-[var(--juhe-void-2)] rounded-md px-2 py-1 border border-[var(--juhe-border)]/50'>
                <div className='text-[9px] text-[var(--juhe-text-3)] uppercase tracking-wider'>{item.label}</div>
                <div className='text-[11px] font-medium truncate' title={item.value}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reference Images */}
      {p.referenceImages && p.referenceImages.length > 0 && (
        <ReferenceImages images={p.referenceImages} title='Reference Images' />
      )}

      {/* Frame References */}
      {(p.firstFrame || p.lastFrame) && (
        <div className='space-y-0.5'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-[var(--juhe-text-3)]'>
            <Film className='w-3 h-3' />Frame References
          </div>
          <div className='flex gap-2'>
            {[p.firstFrame, p.lastFrame].filter(Boolean).map((frame, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={i}
                className='w-14 h-14 rounded-md overflow-hidden bg-[var(--juhe-void-3)] border border-[var(--juhe-border)]/50'
              >
                <img
                  src={frame!.startsWith('data:') ? frame! : `data:image/png;base64,${frame}`}
                  alt={i === 0 ? 'First Frame' : 'Last Frame'}
                  className='w-full h-full object-cover'
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outputs */}
      {task.outputs.length > 0 && (
        <div className='space-y-0.5'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-[var(--juhe-text-3)]'>
            <Maximize2 className='w-3 h-3' />Outputs ({task.outputs.length})
          </div>
          <div className='flex gap-2 flex-wrap'>
            {task.outputs.map((output, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
              <div key={i} className='group relative'>
                <div className='w-20 h-20 rounded-md overflow-hidden bg-[var(--juhe-void-3)] border border-[var(--juhe-border)]/50'>
                  {output.url ? (
                    <ImageOrVideo
                      src={output.url}
                      alt={`Output ${i + 1}`}
                      type={output.type}
                      onClick={() => onZoomImage?.(output.url ?? '')}
                    />
                  ) : output.base64 ? (
                    <img
                      src={`data:${output.mediaType || 'image/png'};base64,${output.base64}`}
                      alt={`Output ${i + 1}`}
                      className='w-full h-full object-cover cursor-pointer'
                      loading='lazy'
                      onClick={() => onZoomImage?.(`data:${output.mediaType || 'image/png'};base64,${output.base64}`)}
                    />
                  ) : (
                    <div className='w-full h-full flex items-center justify-center'>
                      <CheckCircle2 className='w-5 h-5 text-[var(--juhe-emerald)]' />
                    </div>
                  )}
                </div>
                {output.url && (
                  <a
                    href={output.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                    title='Open in new tab'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className='w-2.5 h-2.5' />
                  </a>
                )}
                <div className='text-[9px] text-[var(--juhe-text-3)] text-center mt-0.5'>
                  {output.type} · {output.mediaType?.split('/')[1] || 'unknown'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error — truncated by default, expandable when too long */}
      {task.error && (
        <div className='space-y-0.5'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-[var(--juhe-magenta)]'>
            <AlertCircle className='w-3 h-3' />Error
          </div>
          <div className='text-[11px] text-[var(--juhe-magenta)] bg-[var(--juhe-magenta)]/5 rounded-md p-2 border border-[rgba(255,45,149,0.3)]/20 whitespace-pre-wrap break-words max-h-[4.5em] overflow-hidden relative'>
            {errorExpanded || !errorTooLong
              ? task.error
              : `${task.error.slice(0, ERROR_PREVIEW_MAX)}…`}
          </div>
          {errorTooLong && (
            <button
              type='button'
              onClick={() => setErrorExpanded(!errorExpanded)}
              className='flex items-center gap-0.5 text-[10px] text-[var(--juhe-magenta)]/70 hover:text-[var(--juhe-magenta)] transition-colors'
            >
              {errorExpanded
                ? <><ChevronDown className='w-3 h-3' />Collapse</>
                : <><ChevronRight className='w-3 h-3' />Show full error ({task.error!.length} chars)</>}
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className='space-y-0.5'>
        <div className='flex items-center gap-1.5 text-[11px] font-medium text-[var(--juhe-text-3)]'>
          <Clock className='w-3 h-3' />Timeline
        </div>
        <div className='flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-[var(--juhe-text-3)]'>
          <span>Created: {formatFullTime(task.createdAt)}</span>
          {task.startedAt && <span>Started: {formatFullTime(task.startedAt)}</span>}
          {task.completedAt && <span>Completed: {formatFullTime(task.completedAt)}</span>}
          {task.startedAt && task.completedAt && (
            <span>Duration: {formatDuration(task.startedAt, task.completedAt)}</span>
          )}
        </div>
      </div>

      <div className='text-[9px] text-[var(--juhe-text-3)]/50 font-mono'>Task ID: {task.id}</div>
    </div>
  )
}
