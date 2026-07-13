/**
 * CanvasNodeInfoDialog.tsx - 节点信息弹窗
 * 显示节点元数据：类型、尺寸、状态、提示词、文件信息等
 */

import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { canvasThemes } from './canvas-theme'
import type { CanvasNode } from './types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

interface Props {
  node: CanvasNode | null
  open: boolean
  onClose: () => void
}

export function CanvasNodeInfoDialog({ node, open, onClose }: Props) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  if (!open || !node) return null

  const meta = node.metadata
  const isImage = node.type === 'image'
  const isVideo = node.type === 'video'
  const isAudio = node.type === 'audio'
  const _isConfig = node.type === 'config'
  const hasMedia = isImage || isVideo || isAudio

  const rows: { label: string; value: string }[] = [
    { label: t('canvas.nodeInfo.nodeId'), value: node.id },
    { label: t('canvas.nodeInfo.type'), value: typeLabel(node.type, t) },
    { label: t('canvas.nodeInfo.titleLabel'), value: node.title || '-' },
    { label: t('canvas.nodeInfo.position'), value: `(${Math.round(node.position.x)}, ${Math.round(node.position.y)})` },
    { label: t('canvas.nodeInfo.size'), value: `${node.width ?? '-'} × ${node.height ?? '-'}` }
  ]

  if (meta?.status) {
    rows.push({ label: t('canvas.nodeInfo.statusLabel'), value: statusLabel(meta.status, t) })
  }
  if (hasMedia && meta?.naturalWidth && meta?.naturalHeight) {
    rows.push({ label: t('canvas.nodeInfo.originalSize'), value: `${meta.naturalWidth} × ${meta.naturalHeight}` })
  }
  if (meta?.mimeType) {
    rows.push({ label: t('canvas.nodeInfo.format'), value: meta.mimeType })
  }
  if (meta?.bytes != null) {
    rows.push({ label: t('canvas.nodeInfo.fileSize'), value: formatBytes(meta.bytes) })
  }
  if (meta?.prompt) {
    rows.push({ label: t('canvas.nodeInfo.prompt'), value: meta.prompt })
  }
  if (isImage && meta?.freeResize != null) {
    rows.push({
      label: t('canvas.nodeInfo.freeResize'),
      value: meta.freeResize ? t('canvas.nodeInfo.yes') : t('canvas.nodeInfo.no')
    })
  }
  if (meta?.batchChildIds && meta.batchChildIds.length > 0) {
    rows.push({
      label: t('canvas.nodeInfo.batchChildNodes'),
      value: t('canvas.nodeInfo.childCount', { count: meta.batchChildIds.length })
    })
  }
  if (meta?.batchRootId) {
    rows.push({ label: t('canvas.nodeInfo.batchBelongsTo'), value: meta.batchRootId })
  }

  return (
    <div className='fixed inset-0 z-[95] flex items-center justify-center'>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        className='relative w-[420px] max-h-[560px] overflow-y-auto rounded-2xl p-6 shadow-2xl'
        style={{ background: theme.node.fill, borderColor: theme.node.stroke, borderWidth: 1 }}
      >
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-base font-semibold' style={{ color: theme.node.text }}>
            {t('canvas.nodeInfo.title')}
          </h3>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg p-1 transition hover:bg-white/5'
            style={{ color: theme.node.muted }}
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='2'>
              <line x1='3' y1='3' x2='13' y2='13' />
              <line x1='13' y1='3' x2='3' y2='13' />
            </svg>
          </button>
        </div>

        {/* 缩略图 */}
        {hasMedia && meta?.content && (
          <div className='mb-4 overflow-hidden rounded-xl bg-black/20'>
            {isImage || isVideo ? (
              <img src={meta.content} alt={node.title || ''} className='block max-h-[200px] w-full object-contain' />
            ) : null}
          </div>
        )}

        {/* 信息行 */}
        <div className='space-y-2'>
          {rows.map((row) => (
            <div key={row.label} className='flex gap-3 text-xs'>
              <span className='w-20 shrink-0' style={{ color: theme.node.muted }}>
                {row.label}
              </span>
              <span className='flex-1 break-words' style={{ color: theme.node.text }}>
                {row.value.length > 200 ? `${row.value.slice(0, 200)}…` : row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function typeLabel(type: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    image: t('canvas.nodeInfo.nodeType.image'),
    text: t('canvas.nodeInfo.nodeType.text'),
    config: t('canvas.nodeInfo.nodeType.config'),
    video: t('canvas.nodeInfo.nodeType.video'),
    audio: t('canvas.nodeInfo.nodeType.audio'),
    output: t('canvas.nodeInfo.nodeType.output'),
    group: t('canvas.nodeInfo.nodeType.group'),
    llm: t('canvas.nodeInfo.nodeType.llm'),
    loop: t('canvas.nodeInfo.nodeType.loop'),
    comfy: t('canvas.nodeInfo.nodeType.comfy'),
    modelscope: t('canvas.nodeInfo.nodeType.modelscope')
  }
  return map[type] || type
}

function statusLabel(status: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    pending: t('canvas.nodeInfo.status.pending'),
    processing: t('canvas.nodeInfo.status.processing'),
    completed: t('canvas.nodeInfo.status.completed'),
    failed: t('canvas.nodeInfo.status.failed'),
    cancelled: t('canvas.nodeInfo.status.cancelled'),
    queued: t('canvas.nodeInfo.status.queued'),
    loading: t('canvas.nodeInfo.status.loading'),
    error: t('canvas.nodeInfo.status.error')
  }
  return map[status] || status
}
