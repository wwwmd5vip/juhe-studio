/**
 * CanvasNodeHoverToolbar.tsx - 节点悬停工具栏
 * 1:1 复刻 infinite-canvas-main
 */

import {
  Brush,
  Camera,
  Copy,
  Crop,
  Download,
  Ellipsis,
  FileText,
  FolderPlus,
  Grid3X3,
  Image as ImageIcon,
  Info,
  Maximize2,
  MessageSquare,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  ZoomIn
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasNode } from './types'

interface CanvasNodeHoverToolbarProps {
  node: CanvasNode | null
  /** Screen-space left/top for absolute positioning */
  left: number
  top: number
  visible: boolean
  imageToolIds?: string[]
  showImageToolLabels?: boolean
  onDelete: (nodeId: string) => void
  onRetry?: (nodeId: string) => void
  onSaveAsset?: (nodeId: string) => void
  onDownload?: (nodeId: string) => void
  onToggleDialog?: (nodeId: string) => void
  onEditText?: (nodeId: string) => void
  onDecreaseFont?: (nodeId: string) => void
  onIncreaseFont?: (nodeId: string) => void
  onGenerateImage?: (nodeId: string) => void
  onConfig?: (nodeId: string) => void
  onUpload?: (nodeId: string) => void
  onMaskEdit?: (nodeId: string) => void
  onCrop?: (nodeId: string) => void
  onSplit?: (nodeId: string) => void
  onUpscale?: (nodeId: string) => void
  onSuperResolve?: (nodeId: string) => void
  onAngle?: (nodeId: string) => void
  onViewImage?: (nodeId: string) => void
  onCopyPrompt?: (nodeId: string) => void
  onReversePrompt?: (nodeId: string) => void
  onToggleFreeResize?: (nodeId: string) => void
  onInfo?: (nodeId: string) => void
  onOpenToolbarSettings?: () => void
  /** Keep toolbar visible (mouse entered toolbar) */
  onKeep: () => void
  /** Hide toolbar (mouse left toolbar) */
  onLeave: () => void
}

interface ToolItem {
  id: string
  title: string
  label: string
  icon: React.ReactNode
  active?: boolean
  danger?: boolean
  onClick: () => void
}

export function CanvasNodeHoverToolbar({
  node,
  left,
  top,
  visible,
  onDelete,
  onRetry,
  onSaveAsset,
  onDownload,
  onToggleDialog,
  onEditText,
  onDecreaseFont,
  onIncreaseFont,
  onGenerateImage,
  onConfig,
  onUpload,
  onMaskEdit,
  onCrop,
  onSplit,
  onUpscale,
  onSuperResolve,
  onAngle,
  onViewImage,
  onCopyPrompt,
  onReversePrompt,
  onToggleFreeResize,
  onInfo,
  onOpenToolbarSettings,
  onKeep,
  onLeave
}: CanvasNodeHoverToolbarProps) {
  const { t } = useTranslation()
  const [showMore, setShowMore] = useState(false)

  if (!node || !visible) return null

  const isImage = node.type === 'image'
  const isText = node.type === 'text'
  const isConfig = node.type === 'config'
  const isLLM = node.type === 'llm'
  const isComfy = node.type === 'comfy'
  const hasError = node.metadata?.status === 'error'
  const hasImageContent = isImage && Boolean(node.metadata?.content)
  const hasVideoContent = node.type === 'video' && Boolean(node.metadata?.content)
  const hasAudioContent = node.type === 'audio' && Boolean(node.metadata?.content)
  const hasContent = hasImageContent || hasVideoContent || hasAudioContent
  const hasDialog = isConfig || isLLM || isComfy || isText || isImage || node.type === 'video' || node.type === 'audio'
  const isFreeResize = node.metadata?.freeResize ?? false

  // Build tool items in reference order
  const tools: ToolItem[] = [
    // Always: info
    ...(onInfo
      ? [
          {
            id: 'info',
            title: t('canvas.nodeContent.viewNodeInfo'),
            label: t('canvas.toolbarDetail.info'),
            icon: <Info className='size-4' />,
            onClick: () => onInfo(node.id)
          }
        ]
      : []),

    // Conditional before delete
    ...(hasError && onRetry
      ? [
          {
            id: 'retry',
            title: t('canvas.nodeContent.generationFailed'),
            label: t('canvas.toolbarDetail.retry'),
            icon: <RefreshCw className='size-4' />,
            onClick: () => onRetry(node.id)
          }
        ]
      : []),
    ...(hasContent && onSaveAsset
      ? [
          {
            id: 'saveAsset',
            title: t('canvas.nodeContent.addToAssetLibrary'),
            label: t('canvas.toolbarDetail.saveAsset'),
            icon: <FolderPlus className='size-4' />,
            onClick: () => onSaveAsset(node.id)
          }
        ]
      : []),
    ...(hasContent && onDownload
      ? [
          {
            id: 'download',
            title: t('canvas.toolbarDetail.download'),
            label: t('canvas.toolbarDetail.download'),
            icon: <Download className='size-4' />,
            onClick: () => onDownload(node.id)
          }
        ]
      : []),
    ...(hasDialog && onToggleDialog
      ? [
          {
            id: 'edit',
            title: t('canvas.nodeContent.openDialog'),
            label: t('canvas.toolbarDetail.toggleDialog'),
            icon: <MessageSquare className='size-4' />,
            onClick: () => onToggleDialog(node.id)
          }
        ]
      : []),

    // Text tools
    ...(isText && onEditText
      ? [
          {
            id: 'editText',
            title: t('canvas.toolbarDetail.editText'),
            label: t('canvas.toolbarDetail.editText'),
            icon: <Pencil className='size-4' />,
            onClick: () => onEditText(node.id)
          }
        ]
      : []),
    ...(isText && onGenerateImage
      ? [
          {
            id: 'generateImage',
            title: t('canvas.nodeContent.textToImage'),
            label: t('canvas.toolbarDetail.generateImage'),
            icon: <ImageIcon className='size-4' />,
            onClick: () => onGenerateImage(node.id)
          }
        ]
      : []),
    ...(isText && onDecreaseFont
      ? [
          {
            id: 'decreaseFont',
            title: t('canvas.toolbarDetail.decreaseFont'),
            label: t('canvas.toolbarDetail.decreaseFont'),
            icon: <Minus className='size-4' />,
            onClick: () => onDecreaseFont(node.id)
          }
        ]
      : []),
    ...(isText && onIncreaseFont
      ? [
          {
            id: 'increaseFont',
            title: t('canvas.toolbarDetail.increaseFont'),
            label: t('canvas.toolbarDetail.increaseFont'),
            icon: <Plus className='size-4' />,
            onClick: () => onIncreaseFont(node.id)
          }
        ]
      : []),

    // Config
    ...(isConfig && onConfig
      ? [
          {
            id: 'config',
            title: t('canvas.toolbarDetail.config'),
            label: t('canvas.toolbarDetail.config'),
            icon: <Settings2 className='size-4' />,
            onClick: () => onConfig(node.id)
          }
        ]
      : []),

    // Image upload (empty image)
    ...(isImage && !hasImageContent && onUpload
      ? [
          {
            id: 'uploadImage',
            title: t('canvas.toolbarDetail.uploadImage'),
            label: t('canvas.toolbarDetail.uploadImage'),
            icon: <Upload className='size-4' />,
            onClick: () => onUpload(node.id)
          }
        ]
      : []),

    // Image tools (only visible when showMore or collapsed by quickImageToolIds)
    ...(isImage && hasImageContent
      ? buildImageToolbarTools(t, node, showMore, {
          onMaskEdit,
          onCrop,
          onSplit,
          onUpscale,
          onSuperResolve,
          onAngle,
          onViewImage,
          onCopyPrompt,
          onReversePrompt,
          onToggleFreeResize,
          isFreeResize
        })
      : []),

    // Always: more (image only) and delete
    ...(isImage && hasImageContent
      ? [
          {
            id: 'more',
            title: t('canvas.toolbarDetail.quickTools'),
            label: showMore ? t('canvas.toolbarDetail.collapse') : t('canvas.toolbarDetail.more'),
            icon: <Ellipsis className='size-4' />,
            onClick: () => (onOpenToolbarSettings ? onOpenToolbarSettings() : setShowMore((v) => !v))
          }
        ]
      : []),
    {
      id: 'delete',
      title: t('canvas.nodeContent.deleteNode'),
      label: t('canvas.toolbarDetail.delete'),
      icon: <Trash2 className='size-4' />,
      onClick: () => onDelete(node.id),
      danger: true
    }
  ]

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      className='absolute z-[70] flex h-12 -translate-x-1/2 -translate-y-full items-center overflow-visible rounded-[18px] border border-black/10 bg-white text-[15px] text-[#242529]'
      style={{
        left,
        top,
        boxShadow: '0 8px 28px rgba(15,23,42,.12)'
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={onKeep}
      onMouseLeave={onLeave}
    >
      {tools.map((tool) => (
        <ToolbarAction
          key={tool.id}
          title={tool.title}
          label={tool.label}
          icon={tool.icon}
          active={tool.active}
          danger={tool.danger}
          onClick={tool.onClick}
        />
      ))}
    </div>
  )
}

function buildImageToolbarTools(
  t: (key: string) => string,
  node: CanvasNode,
  showMore: boolean,
  handlers: {
    onMaskEdit?: (nodeId: string) => void
    onCrop?: (nodeId: string) => void
    onSplit?: (nodeId: string) => void
    onUpscale?: (nodeId: string) => void
    onSuperResolve?: (nodeId: string) => void
    onAngle?: (nodeId: string) => void
    onViewImage?: (nodeId: string) => void
    onCopyPrompt?: (nodeId: string) => void
    onReversePrompt?: (nodeId: string) => void
    onToggleFreeResize?: (nodeId: string) => void
    isFreeResize: boolean
  }
): ToolItem[] {
  // Load quick tool IDs from localStorage
  let quickIds: Set<string>
  try {
    quickIds = new Set(JSON.parse(localStorage.getItem('IMAGE_QUICK_TOOLS_STORAGE_IDS') || '[]') as string[])
  } catch (err) {
    console.error('Failed to parse IMAGE_QUICK_TOOLS_STORAGE_IDS from localStorage:', err)
    quickIds = new Set()
  }

  const all: ToolItem[] = [
    ...(handlers.onCopyPrompt
      ? [
          {
            id: 'copyPrompt',
            title: t('canvas.toolbarDetail.copyPrompt'),
            label: t('canvas.toolbarDetail.copyPrompt'),
            icon: <Copy className='size-4' />,
            onClick: () => handlers.onCopyPrompt?.(node.id)
          }
        ]
      : []),
    ...(handlers.onReversePrompt
      ? [
          {
            id: 'reversePrompt',
            title: t('canvas.toolbarDetail.reversePrompt'),
            label: t('canvas.toolbarDetail.reversePrompt'),
            icon: <FileText className='size-4' />,
            onClick: () => handlers.onReversePrompt?.(node.id)
          }
        ]
      : []),
    ...(handlers.onToggleFreeResize
      ? [
          {
            id: 'freeResize',
            title: handlers.isFreeResize ? t('canvas.toolbarDetail.lockRatio') : t('canvas.toolbarDetail.freeRatio'),
            label: handlers.isFreeResize ? t('canvas.toolbarDetail.lockRatio') : t('canvas.toolbarDetail.freeRatio'),
            icon: <Maximize2 className='size-4' />,
            onClick: () => handlers.onToggleFreeResize?.(node.id)
          }
        ]
      : []),
    ...(handlers.onMaskEdit
      ? [
          {
            id: 'maskEdit',
            title: t('canvas.toolbarDetail.maskEdit'),
            label: t('canvas.toolbarDetail.maskEdit'),
            icon: <Brush className='size-4' />,
            onClick: () => handlers.onMaskEdit?.(node.id)
          }
        ]
      : []),
    ...(handlers.onCrop
      ? [
          {
            id: 'crop',
            title: t('canvas.toolbarDetail.crop'),
            label: t('canvas.toolbarDetail.crop'),
            icon: <Crop className='size-4' />,
            onClick: () => handlers.onCrop?.(node.id)
          }
        ]
      : []),
    ...(handlers.onSplit
      ? [
          {
            id: 'split',
            title: t('canvas.toolbarDetail.split'),
            label: t('canvas.toolbarDetail.split'),
            icon: <Grid3X3 className='size-4' />,
            onClick: () => handlers.onSplit?.(node.id)
          }
        ]
      : []),
    ...(handlers.onUpscale
      ? [
          {
            id: 'upscale',
            title: t('canvas.toolbarDetail.upscale'),
            label: t('canvas.toolbarDetail.upscale'),
            icon: <ZoomIn className='size-4' />,
            onClick: () => handlers.onUpscale?.(node.id)
          }
        ]
      : []),
    ...(handlers.onSuperResolve
      ? [
          {
            id: 'superResolve',
            title: t('canvas.toolbarDetail.superResolve'),
            label: t('canvas.toolbarDetail.superResolve'),
            icon: <Sparkles className='size-4' />,
            onClick: () => handlers.onSuperResolve?.(node.id)
          }
        ]
      : []),
    ...(handlers.onAngle
      ? [
          {
            id: 'angle',
            title: t('canvas.toolbarDetail.angle'),
            label: t('canvas.toolbarDetail.angle'),
            icon: <Camera className='size-4' />,
            onClick: () => handlers.onAngle?.(node.id)
          }
        ]
      : []),
    ...(handlers.onViewImage
      ? [
          {
            id: 'view',
            title: t('canvas.toolbarDetail.viewImage'),
            label: t('canvas.toolbarDetail.viewImage'),
            icon: <Maximize2 className='size-4' />,
            onClick: () => handlers.onViewImage?.(node.id)
          }
        ]
      : [])
  ]

  if (!showMore && quickIds.size > 0) {
    return all.filter((t) => quickIds.has(t.id))
  }
  return all
}

function ToolbarAction({
  title,
  icon,
  onClick,
  active = false,
  danger = false
}: {
  title: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      type='button'
      className={`group relative flex h-12 items-center whitespace-nowrap px-1.5 ${danger ? 'text-[#ef4444]' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <span
        className={`flex h-9 items-center rounded-lg transition-colors group-hover:bg-[#f0f0f1] ${active ? 'bg-[#eeeeef]' : ''}`}
        style={{ justifyContent: 'center', padding: '0 0.5rem' }}
      >
        {icon}
      </span>
    </button>
  )
}
