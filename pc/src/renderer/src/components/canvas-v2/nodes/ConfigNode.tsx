/**
 * ConfigNode - 生成器/配置节点 (完整复刻)
 * 模式切换 · 模型选择器 · 输入统计 · 设置弹窗 · 信用 Run 按钮
 */

import { Image, LoaderCircle, MessageSquare, Music2, Play, Settings2, Square, Video } from 'lucide-react'
import type React from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasAudioSettingsPopover } from '../CanvasAudioSettingsPopover'
import { CanvasImageSettingsPopover } from '../CanvasImageSettingsPopover'
import { CanvasNodeView } from '../CanvasNode'
import { CanvasVideoSettingsPopover } from '../CanvasVideoSettingsPopover'
import type { CanvasTheme } from '../canvas-theme'
import { ResourceMentionTextarea } from '../ResourceMentionTextarea'
import type { CanvasNode, Position } from '../types'
import type { CanvasResourceReference } from '../utils/canvas-reference'
import { modelHasCapabilityForMode } from '@shared/utils/model-capabilities'

type GenerationMode = 'image' | 'text' | 'video' | 'audio'

interface ConfigNodeProps {
  node: CanvasNode
  scale: number
  isSelected: boolean
  isRelated: boolean
  isConnectionTarget: boolean
  isConnecting: boolean
  onMouseDown: (event: React.MouseEvent, nodeId: string) => void
  onResize: (nodeId: string, width: number, height: number, position?: Position) => void
  onConnectStart: (event: React.MouseEvent, nodeId: string, handleType: 'source' | 'target') => void
  onContextMenu: (event: React.MouseEvent, nodeId: string) => void
  onUpdate?: (nodeId: string, metadata: Record<string, unknown>) => void
  onRun?: (nodeId: string) => void
  isRunning?: boolean
  /** 可引用的资源节点列表 */
  references?: CanvasResourceReference[]
  /** 上游输入统计 */
  inputSummary?: { textCount: number; imageCount: number; videoCount: number; audioCount: number }
  /** 启用的模型列表 */
  availableModels?: Array<{ id: string; name: string; displayName?: string; capabilities?: string[] }>
}

const MODE_TABS: Array<{ value: GenerationMode; icon: React.ReactNode }> = [
  { value: 'image', icon: <Image className='size-3.5' /> },
  { value: 'text', icon: <MessageSquare className='size-3.5' /> },
  { value: 'video', icon: <Video className='size-3.5' /> },
  { value: 'audio', icon: <Music2 className='size-3.5' /> }
]

const MODE_LABELS: Record<GenerationMode, string> = {
  image: 'canvas.config.modes.image',
  text: 'canvas.config.modes.text',
  video: 'canvas.config.modes.video',
  audio: 'canvas.config.modes.audio'
}

const _SIZE_OPTIONS = [
  { label: '1:1 (1024×1024)', value: '1024x1024' },
  { label: '16:9 (1792×1024)', value: '1792x1024' },
  { label: '9:16 (1024×1792)', value: '1024x1792' },
  { label: '4:3 (1152×896)', value: '1152x896' },
  { label: '3:4 (896×1152)', value: '896x1152' }
]

export function ConfigNode(props: ConfigNodeProps) {
  return (
    <CanvasNodeView
      data={props.node}
      scale={props.scale}
      isSelected={props.isSelected}
      isRelated={props.isRelated}
      isConnectionTarget={props.isConnectionTarget}
      isConnecting={props.isConnecting}
      onMouseDown={props.onMouseDown}
      onResize={props.onResize}
      onConnectStart={props.onConnectStart}
      onContextMenu={props.onContextMenu}
      renderContent={(node, theme) => (
        <ConfigPanel
          node={node}
          theme={theme}
          onUpdate={props.onUpdate}
          onRun={props.onRun}
          isRunning={props.isRunning}
          references={props.references}
          inputSummary={props.inputSummary}
          availableModels={props.availableModels}
        />
      )}
    />
  )
}

function ConfigPanel({
  node,
  theme,
  onUpdate,
  onRun,
  isRunning = false,
  references = [],
  inputSummary = { textCount: 0, imageCount: 0, videoCount: 0, audioCount: 0 },
  availableModels = []
}: {
  node: CanvasNode
  theme: CanvasTheme
  onUpdate?: (nodeId: string, metadata: Record<string, unknown>) => void
  onRun?: (nodeId: string) => void
  isRunning?: boolean
  references?: CanvasResourceReference[]
  inputSummary?: { textCount: number; imageCount: number; videoCount: number; audioCount: number }
  availableModels?: Array<{ id: string; name: string; displayName?: string; capabilities?: string[] }>
}) {
  const { t } = useTranslation()
  const mode = (node.metadata?.generationMode as GenerationMode) || 'image'
  const compatibleModels = useMemo(
    () => (availableModels ?? []).filter((m) => modelHasCapabilityForMode(m.capabilities, mode)),
    [availableModels, mode]
  )
  const currentModel = (node.metadata?.model as string) || ''
  const hasCompatibleModel = compatibleModels.some((m) => m.id === currentModel)
  const model = hasCompatibleModel ? currentModel : compatibleModels[0]?.id || ''
  const count = Math.max(1, Math.min(15, Math.abs(Number(node.metadata?.count) || 1)))
  const size = node.metadata?.size || '1024x1024'
  const quality = node.metadata?.quality || 'standard'
  const hasAnyInput = Boolean(
    inputSummary.textCount || inputSummary.imageCount || inputSummary.videoCount || inputSummary.audioCount
  )
  const hasPrompt = Boolean((node.metadata?.composerContent ?? node.metadata?.prompt ?? '').trim())
  const canGenerate = (hasPrompt || hasAnyInput) && hasCompatibleModel

  const update = useCallback((patch: Record<string, unknown>) => onUpdate?.(node.id, patch), [node.id, onUpdate])

  const [showComposer, setShowComposer] = useState(false)

  const chipStyle = useMemo(
    () => ({ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }),
    [theme]
  )

  return (
    <div
      className='flex h-full w-full flex-col px-3 pb-3 pt-8 gap-2'
      style={{ color: theme.node.text }}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Mode tabs */}
      <div className='flex items-center justify-between'>
        <span className='text-sm font-semibold shrink-0'>{t('canvas.nodeContent.generationConfig')}</span>
        <div className='flex gap-0.5 rounded-md p-0.5' style={{ background: theme.toolbar.activeBg }}>
          {MODE_TABS.map((tab) => (
            <button
              key={tab.value}
              type='button'
              className='flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors'
              style={{
                background: mode === tab.value ? theme.node.panel : 'transparent',
                color: mode === tab.value ? theme.node.text : theme.node.muted
              }}
              onClick={(e) => {
                e.stopPropagation()
                update({ generationMode: tab.value })
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {tab.icon}
              {t(MODE_LABELS[tab.value])}
            </button>
          ))}
        </div>
      </div>
      {/* Input chips */}
      <div className='flex flex-wrap gap-1.5'>
        {inputSummary.textCount > 0 && (
          <Chip label={t('canvas.nodeLabels.prompt')} value={`${inputSummary.textCount} 个`} style={chipStyle} />
        )}
        {inputSummary.imageCount > 0 && (
          <Chip label={t('canvas.config.referenceImage')} value={`${inputSummary.imageCount} 张`} style={chipStyle} />
        )}
        {inputSummary.videoCount > 0 && (
          <Chip label={t('canvas.config.referenceVideo')} value={`${inputSummary.videoCount} 个`} style={chipStyle} />
        )}
        {inputSummary.audioCount > 0 && (
          <Chip label={t('canvas.config.referenceAudio')} value={`${inputSummary.audioCount} 个`} style={chipStyle} />
        )}
        <button
          type='button'
          className='inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px]'
          style={chipStyle}
          onClick={(e) => {
            e.stopPropagation()
            setShowComposer((v) => !v)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Settings2 className='size-3.5' />
          {t('canvas.config.assemblePrompt')}
        </button>
      </div>
      {/* @Mention composer (toggled) */}
      {showComposer && (
        <div className='rounded-lg border' style={{ borderColor: theme.node.stroke }}>
          <ResourceMentionTextarea
            value={(node.metadata?.composerContent as string) || (node.metadata?.prompt as string) || ''}
            references={references}
            placeholder={t('canvas.config.composerPlaceholder')}
            className='h-20 w-full resize-none bg-transparent px-3 py-2 text-xs font-mono thin-scrollbar'
            style={{ color: theme.node.text }}
            onChange={(value) => update({ composerContent: value, prompt: value })}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {/* Model selector + settings popover */}\n{' '}
      <div
        className='grid items-start gap-2'
        style={{ gridTemplateColumns: compatibleModels.length > 0 ? 'minmax(0,1fr) auto' : '1fr' }}
      >
        {compatibleModels.length > 0 ? (
          <select
            className='h-10 rounded-lg border bg-transparent px-2 text-[11px] outline-none cursor-pointer'
            style={{ borderColor: theme.node.stroke, color: theme.node.text }}
            value={model}
            onChange={(e) => update({ model: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {compatibleModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName || m.name}
              </option>
            ))}
          </select>
        ) : (
          <div
            className='h-10 flex items-center rounded-lg border px-2 text-[11px]'
            style={{ borderColor: theme.node.stroke, color: theme.node.muted }}
          >
            {t('canvas.config.noModel')}
          </div>
        )}

        {/* Settings popover (mode-dependent) */}
        {mode === 'image' && (
          <CanvasImageSettingsPopover
            config={{ quality, size, count }}
            onChange={(key, value) => update({ [key]: value })}
          />
        )}
        {mode === 'video' && (
          <CanvasVideoSettingsPopover
            config={{
              vquality: (node.metadata?.vquality as string) || 'auto',
              size,
              seconds: (node.metadata?.seconds as string) || 'auto'
            }}
            onChange={(key, value) => update({ [key]: value })}
          />
        )}
        {mode === 'audio' && (
          <CanvasAudioSettingsPopover
            config={{
              audioVoice: (node.metadata?.audioVoice as string) || 'auto',
              audioFormat: (node.metadata?.audioFormat as string) || 'auto',
              audioSpeed: (node.metadata?.audioSpeed as string) || 'auto'
            }}
            onChange={(key, value) => update({ [key]: value })}
          />
        )}
      </div>
      {/* Count control (only for image/text mode; video/audio handle seconds separately) */}
      {(mode === 'image' || mode === 'text') && (
        <div className='flex items-center gap-2 text-[11px]'>
          <span style={{ color: theme.node.muted }}>{t('canvas.node.count')}</span>
          <div className='flex items-center gap-0.5 ml-auto'>
            <button
              type='button'
              className='flex size-6 items-center justify-center rounded border text-xs'
              style={{ borderColor: theme.node.stroke, color: theme.node.text }}
              onClick={() => update({ count: Math.max(1, count - 1) })}
              onMouseDown={(e) => e.stopPropagation()}
            >
              −
            </button>
            <span className='w-6 text-center tabular-nums'>{count}</span>
            <button
              type='button'
              className='flex size-6 items-center justify-center rounded border text-xs'
              style={{ borderColor: theme.node.stroke, color: theme.node.text }}
              onClick={() => update({ count: Math.min(15, count + 1) })}
              onMouseDown={(e) => e.stopPropagation()}
            >
              +
            </button>
          </div>
        </div>
      )}
      {/* Run button */}
      <button
        type='button'
        className='mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-all'
        style={{
          background: isRunning ? '#ef4444' : '#2f80ff',
          color: '#fff',
          opacity: !isRunning && !canGenerate ? 0.4 : 1
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!isRunning && canGenerate) onRun?.(node.id)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={!isRunning && !canGenerate}
      >
        {isRunning ? (
          <>
            <LoaderCircle className='size-4 animate-spin' />
            <Square className='size-3.5 fill-current' />
            <span>{t('canvas.actions.stop')}</span>
          </>
        ) : (
          <>
            <Play className='size-4' />
            <span>{t('canvas.config.startGenerate')}</span>
          </>
        )}
      </button>
    </div>
  )
}

function Chip({ label, value, style }: { label: string; value: string; style: React.CSSProperties }) {
  return (
    <div className='inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px]' style={style}>
      <span>{label}</span>
      <span className='font-medium'>{value}</span>
    </div>
  )
}
