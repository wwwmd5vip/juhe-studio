/**
 * CanvasNodePromptPanel.tsx - 节点下方生成面板（选中时显示）
 * 复刻参考项目：@mention 输入区 · 模型选择 · 设置弹窗 · 信用 · 运行
 */

import { ArrowUp, Cpu, LoaderCircle, Square } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'
import { modelHasCapabilityForMode } from '@shared/utils/model-capabilities'
import { CanvasAudioSettingsPopover } from './CanvasAudioSettingsPopover'
import { CanvasImageSettingsPopover } from './CanvasImageSettingsPopover'
import { CanvasPromptLibrary } from './CanvasPromptLibrary'
import { CanvasVideoSettingsPopover } from './CanvasVideoSettingsPopover'
import { canvasThemes } from './canvas-theme'
import { ResourceMentionTextarea } from './ResourceMentionTextarea'
import type { CanvasGenerationMode, CanvasNode } from './types'
import type { CanvasResourceReference } from './utils/canvas-reference'

interface Props {
  node: CanvasNode
  isRunning: boolean
  mode: CanvasGenerationMode
  mentionReferences?: CanvasResourceReference[]
  availableModels?: Array<{ id: string; name: string; displayName?: string; capabilities?: string[] }>
  onPromptChange: (nodeId: string, prompt: string) => void
  onConfigChange: (nodeId: string, patch: Record<string, unknown>) => void
  onGenerate: (nodeId: string, mode: CanvasGenerationMode) => void
  onStop: (nodeId: string) => void
  onOpenPromptLibrary?: () => void
}

export function CanvasNodePromptPanel({
  node,
  isRunning,
  mode,
  mentionReferences = [],
  availableModels = [],
  onPromptChange,
  onConfigChange,
  onGenerate,
  onStop,
  onOpenPromptLibrary
}: Props) {
  const { t } = useTranslation()
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const hasImageContent = node.type === 'image' && Boolean(node.metadata?.content)
  const hasTextContent = node.type === 'text' && Boolean(node.metadata?.content?.trim())
  const isEditingExisting = hasTextContent || hasImageContent

  const [prompt, setPrompt] = useState(isEditingExisting ? '' : (node.metadata?.prompt as string) || '')
  const [showPromptLibrary, setShowPromptLibrary] = useState(false)

  useEffect(() => {
    setPrompt(isEditingExisting ? '' : (node.metadata?.prompt as string) || '')
  }, [isEditingExisting, node.metadata?.prompt])

  const updatePrompt = useCallback(
    (value: string) => {
      setPrompt(value)
      if (!isEditingExisting) onPromptChange(node.id, value)
    },
    [node.id, isEditingExisting, onPromptChange]
  )

  const submit = useCallback(() => {
    const text = prompt.trim()
    if (!text || isRunning) return
    onGenerate(node.id, mode)
    setPrompt('')
  }, [prompt, isRunning, node.id, mode, onGenerate])

  const placeholder = useMemo(() => {
    if (mode === 'video') return t('canvas.promptPanel.videoPlaceholder')
    if (mode === 'audio') return t('canvas.promptPanel.audioPlaceholder')
    if (mode === 'image')
      return hasImageContent ? t('canvas.promptPanel.imageEditPlaceholder') : t('canvas.promptPanel.imagePlaceholder')
    return hasTextContent ? t('canvas.promptPanel.textEditPlaceholder') : t('canvas.promptPanel.textPlaceholder')
  }, [mode, hasImageContent, hasTextContent, t])

  // 按当前生成模式过滤可用模型，避免把文本模型选去给图像/视频/音频生成
  const compatibleModels = useMemo(
    () => (availableModels ?? []).filter((m) => modelHasCapabilityForMode(m.capabilities, mode)),
    [availableModels, mode]
  )
  const currentModel = (node.metadata?.model as string) || ''
  const hasCompatibleModel = compatibleModels.some((m) => m.id === currentModel)

  const config = useMemo(
    () => ({
      quality: (node.metadata?.quality as string) || 'auto',
      size: (node.metadata?.size as string) || 'auto',
      count: Number(node.metadata?.count) || 1,
      vquality: (node.metadata?.vquality as string) || 'auto',
      seconds: (node.metadata?.seconds as string) || 'auto',
      audioVoice: (node.metadata?.audioVoice as string) || 'auto',
      audioFormat: (node.metadata?.audioFormat as string) || 'auto',
      audioSpeed: (node.metadata?.audioSpeed as string) || 'auto'
    }),
    [node.metadata]
  )

  // Estimated credits (simplified)
  const credits = mode === 'image' ? Number(node.metadata?.count || 1) * 2 : 1

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      className='rounded-2xl border p-3 shadow-2xl backdrop-blur'
      style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Prompt textarea */}
      <ResourceMentionTextarea
        value={prompt}
        references={mentionReferences}
        onChange={updatePrompt}
        className='thin-scrollbar h-24 w-full resize-none rounded-xl border px-3 py-2 text-sm leading-5 outline-none'
        style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}
        placeholder={placeholder}
      />

      {/* Toolbar row */}
      <div className='mt-2 flex min-w-0 items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          {/* Prompt library button */}
          <button
            type='button'
            className='flex size-9 items-center justify-center rounded-full border transition hover:opacity-80'
            style={{ borderColor: theme.node.stroke, color: theme.node.text }}
            onClick={() => {
              if (onOpenPromptLibrary) onOpenPromptLibrary()
              else setShowPromptLibrary((v) => !v)
            }}
            title={t('canvas.promptPanel.promptLibrary')}
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg className='size-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
              <path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' />
            </svg>
          </button>

          {/* Model selector */}
          {compatibleModels.length > 0 && (
            <ModelSelect
              value={hasCompatibleModel ? currentModel : ''}
              models={compatibleModels}
              onChange={(model) => onConfigChange(node.id, { model })}
              theme={theme}
              isPromptPanel
              placeholder={t('canvas.promptPanel.selectModel')}
            />
          )}

          {/* Settings popovers by mode */}
          {mode === 'image' && (
            <CanvasImageSettingsPopover
              config={config}
              onChange={(key, value) => onConfigChange(node.id, { [key]: value })}
            />
          )}
          {mode === 'video' && (
            <CanvasVideoSettingsPopover
              config={config}
              onChange={(key, value) => {
                if (key === 'videoSeconds') onConfigChange(node.id, { seconds: value })
                else onConfigChange(node.id, { [key]: value })
              }}
            />
          )}
          {mode === 'audio' && (
            <CanvasAudioSettingsPopover
              config={{
                audioVoice: config.audioVoice,
                audioFormat: config.audioFormat,
                audioSpeed: config.audioSpeed
              }}
              onChange={(key, value) => onConfigChange(node.id, { [key]: value })}
            />
          )}
        </div>

        {/* Run / Stop button */}
        <button
          type='button'
          className='flex h-10 min-w-16 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white transition hover:opacity-90'
          style={{ background: isRunning ? '#ef4444' : '#2f80ff' }}
          onClick={() => (isRunning ? onStop(node.id) : submit())}
          disabled={!isRunning && (!prompt.trim() || !hasCompatibleModel)}
        >
          {isRunning ? (
            <>
              <LoaderCircle className='size-4 animate-spin' />
              <Square className='size-3.5 fill-current' />
              <span>{t('canvas.promptPanel.stop')}</span>
            </>
          ) : (
            <>
              <span className='inline-flex items-center gap-1 text-xs font-medium mono-num'>
                <Cpu className='size-3' />
                {credits.toLocaleString()}
              </span>
              <ArrowUp className='size-4' />
            </>
          )}
        </button>
      </div>

      {/* Inline prompt library */}
      {showPromptLibrary && (
        <div className='mt-2'>
          <CanvasPromptLibrary
            isOpen={showPromptLibrary}
            onClose={() => setShowPromptLibrary(false)}
            onSelectPrompt={(p: string) => {
              updatePrompt(p)
              setShowPromptLibrary(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

// ---- Internal ModelSelect ----

function ModelSelect({
  value,
  models,
  onChange,
  theme,
  isPromptPanel,
  placeholder
}: {
  value: string
  models: Array<{ id: string; name: string; displayName?: string }>
  onChange: (model: string) => void
  theme: { node: { stroke: string; text: string } }
  isPromptPanel?: boolean
  placeholder: string
}) {
  const currentModel = models.find((m) => m.id === value)
  const _label = currentModel?.displayName || currentModel?.name || placeholder

  return (
    <select
      className={`rounded-full border bg-transparent text-xs font-medium outline-none cursor-pointer ${
        isPromptPanel ? 'h-10 px-3 max-w-[160px]' : 'h-8 px-2.5 max-w-[150px]'
      }`}
      style={{ borderColor: theme.node.stroke, color: theme.node.text }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!value && <option value=''>{placeholder}</option>}
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.displayName || m.name}
        </option>
      ))}
    </select>
  )
}

export type { Props as CanvasNodePromptPanelProps }
