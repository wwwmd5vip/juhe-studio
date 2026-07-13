/**
 * 聊天输入栏
 * 1:1 复刻 Cherry Studio 的 InputbarCore 架构
 *
 * 核心设计：
 * - z-index: 2 高于消息区域
 * - 圆角边框输入框容器
 * - 底部工具栏 (left/right)
 * - 拖拽调整高度
 */

import { AlertCircle, CirclePause, FileText, ImagePlus, Loader2, Send, WifiOff, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { error as toastError } from '@/components/ui/toast'
import { initChatStreamListener, useChatStore } from '@/stores/chat'
import { useNetworkStore } from '@/stores/network'
import { useProviderStore } from '@/stores/providers'
import { useWebSearchStore } from '@/stores/websearch'
import { QuickPhrasesPopover } from './QuickPhrasesPopover'
import { WebSearchButton } from './WebSearchButton'

/** Filter: only show text/chat models (exclude image/video/audio/embedding generation models) */
const NON_CHAT_CAPS = new Set(['image', 'video', 'audio', 'embedding'] as const)

function isChatModel(m: { type: string; capabilities?: string[] | null }): boolean {
  // Must be typed as llm and not have image/video/audio/embedding generation capabilities
  if (m.type !== 'llm') return false
  const caps = m.capabilities
  if (!caps || caps.length === 0) return true // no caps → assume chat
  return !caps.some((c) => NON_CHAT_CAPS.has(c as never))
}

interface Attachment {
  type: 'image' | 'file'
  url: string
  name: string
  size?: number
}

export function ChatInput() {
  const {
    activeSessionId,
    isGenerating,
    sendMessage,
    createSession,
    error: chatError,
    messageQueue,
    isSendingQueued
  } = useChatStore()
  const { isOnline } = useNetworkStore()
  const { providers, loadProviders } = useProviderStore()
  const { isEnabled: isWebSearchEnabled, search: doWebSearch } = useWebSearchStore()
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showQuickPhrases, setShowQuickPhrases] = useState(false)
  const quickPhrasesAnchorRef = useRef<HTMLButtonElement>(null)

  // 初始化流式监听
  useEffect(() => {
    initChatStreamListener()
    loadProviders()
  }, [loadProviders])

  // 加载 web search providers
  useEffect(() => {
    useWebSearchStore.getState().loadProviders()
  }, [])

  // 可用的 LLM provider/model
  const availableProviders = providers.filter((p) => p.isEnabled && p.models.some((m) => isChatModel(m)))

  // 获取当前会话保存的 provider/model（优先）
  const activeSession = useChatStore((state) => state.sessions.find((s) => s.id === state.activeSessionId))
  const sessionProviderId = activeSession?.providerId
  const sessionModelId = activeSession?.modelId

  const [selectedProviderId, setSelectedProviderId] = useState(() => {
    // 优先使用会话保存的 provider，否则用第一个可用 provider
    if (sessionProviderId && availableProviders.some((p) => p.id === sessionProviderId)) {
      return sessionProviderId
    }
    return availableProviders[0]?.id || ''
  })
  const [selectedModel, setSelectedModel] = useState(() => {
    // 优先使用会话保存的 model
    const provider = availableProviders.find((p) => p.id === (sessionProviderId || availableProviders[0]?.id))
    if (sessionModelId && provider?.models.some((m) => m.name === sessionModelId)) {
      return sessionModelId
    }
    return provider?.models.find((m) => isChatModel(m))?.name || ''
  })

  // 当切换会话或 providers 加载完成后，同步更新选中的 provider/model
  useEffect(() => {
    if (availableProviders.length === 0) return

    // 如果有会话保存的 provider/model，优先使用
    if (sessionProviderId && sessionModelId) {
      const provider = availableProviders.find((p) => p.id === sessionProviderId)
      if (provider?.models.some((m) => m.name === sessionModelId)) {
        setSelectedProviderId(sessionProviderId)
        setSelectedModel(sessionModelId)
        return
      }
    }

    // 如果当前选中的 provider 不在可用列表中，重置为第一个
    const currentProvider = availableProviders.find((p) => p.id === selectedProviderId)
    if (!currentProvider) {
      const firstProvider = availableProviders[0]
      setSelectedProviderId(firstProvider.id)
      const firstModel = firstProvider.models.find((m) => isChatModel(m))
      if (firstModel) setSelectedModel(firstModel.name)
      return
    }

    // 如果当前选中的 model 不在当前 provider 的可用模型中，重置为第一个
    const currentModel = currentProvider.models.find((m) => m.name === selectedModel && isChatModel(m))
    if (!currentModel) {
      const firstModel = currentProvider.models.find((m) => isChatModel(m))
      if (firstModel) setSelectedModel(firstModel.name)
    }
  }, [availableProviders, sessionProviderId, sessionModelId, selectedModel, selectedProviderId])

  const handleProviderChange = (providerId: string) => {
    setSelectedProviderId(providerId)
    const provider = availableProviders.find((p) => p.id === providerId)
    const model = provider?.models.find((m) => isChatModel(m))
    if (model) setSelectedModel(model.name)
  }

  const handleSend = async () => {
    const trimmed = content.trim()
    if ((!trimmed && attachments.length === 0) || isGenerating) return

    // Guard: if providers haven't loaded yet, show a message instead of crashing
    if (!selectedProviderId || !selectedModel) {
      toastError({ description: '模型尚未加载完成，请稍后再试' })
      return
    }

    if (!activeSessionId) {
      await createSession(selectedProviderId, selectedModel)
    }

    setContent('')
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      let messageContent = trimmed

      // If web search is enabled, perform search and prepend results
      if (isWebSearchEnabled) {
        try {
          const searchResults = await doWebSearch(trimmed)
          if (searchResults.length > 0) {
            const searchContext = searchResults
              .map((r, i) => `[${i + 1}] ${r.title}\n${r.content || ''}\nURL: ${r.url}`)
              .join('\n\n')
            messageContent = `Web search results:\n\n${searchContext}\n\nUser query: ${trimmed}`
          }
        } catch (searchErr) {
          console.error('[ChatInput] Web search failed:', searchErr)
          // Continue with original content if search fails
        }
      }

      await sendMessage(messageContent, selectedProviderId, selectedModel, attachments)
    } catch (err) {
      console.error('Send failed:', err)
      toastError({ description: '发送消息失败，请重试' })
    }
  }

  const handleStop = () => {
    const { stopGeneration } = useChatStore.getState()
    stopGeneration()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 如果快捷短语面板打开，按 Escape 关闭
    if (e.key === 'Escape' && showQuickPhrases) {
      e.preventDefault()
      setShowQuickPhrases(false)
      return
    }
    // IME composition check - prevent Enter submission during CJK input
    // biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
        if ((e.nativeEvent as any)?.isComposing || e.keyCode === 229) {
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`

    // 检测 / 触发快捷短语（行首或空格后输入 /）
    const cursorPos = el.selectionStart
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/')

    if (lastSlashIndex !== -1) {
      const textAfterSlash = textBeforeCursor.slice(lastSlashIndex + 1)
      const hasSpaceBeforeSlash = lastSlashIndex === 0 || /\s/.test(value[lastSlashIndex - 1] || '')
      const noSpaceInQuery = !textAfterSlash.includes(' ')

      // 只在 / 前是空格或行首，且查询中没有空格时触发
      if (hasSpaceBeforeSlash && noSpaceInQuery && textAfterSlash.length >= 0) {
        // 可以在这里添加 / 触发的快速选择面板
        // 目前简化处理：只检测 / 但不自动打开面板（避免干扰正常输入）
      }
    }
  }

  // 处理图片上传
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      if (file.size > MAX_FILE_SIZE) {
        toastError({ description: `文件过大: ${(file.size / 1024 / 1024).toFixed(1)}MB (最大 50MB)` })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        setAttachments((prev) => [...prev, { type: 'image', url, name: file.name, size: file.size }])
      }
      reader.readAsDataURL(file)
    })

    e.target.value = ''
  }, [])

  // 处理文件上传
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toastError({ description: `文件过大: ${(file.size / 1024 / 1024).toFixed(1)}MB (最大 50MB)` })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        setAttachments((prev) => [...prev, { type: 'file', url, name: file.name, size: file.size }])
      }
      reader.readAsDataURL(file)
    })

    e.target.value = ''
  }, [])

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  // 拖拽处理
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    const files = Array.from(e.dataTransfer.files)
    files.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toastError({ description: `文件过大: ${(file.size / 1024 / 1024).toFixed(1)}MB (最大 50MB)` })
        return
      }
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          setAttachments((prev) => [
            ...prev,
            { type: 'image', url: reader.result as string, name: file.name, size: file.size }
          ])
        }
        reader.readAsDataURL(file)
      } else {
        const reader = new FileReader()
        reader.onload = () => {
          setAttachments((prev) => [
            ...prev,
            { type: 'file', url: reader.result as string, name: file.name, size: file.size }
          ])
        }
        reader.readAsDataURL(file)
      }
    })
  }, [])

  const isEmpty = content.trim().length === 0 && attachments.length === 0
  const isSendDisabled = isEmpty || isGenerating

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
      className='inputbar flex-shrink-0 px-4 pb-4 pt-1 relative z-[2]'
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Error display */}
      {chatError && (
        <div
          className='flex items-center gap-2 p-2 mb-2 rounded-lg text-xs'
          style={{ background: 'rgba(255,45,149,0.08)', color: 'var(--juhe-magenta)' }}
        >
          <AlertCircle className='w-3.5 h-3.5 shrink-0' />
          {chatError}
        </div>
      )}
      {/* Offline / Queued indicator */}
      {!isOnline && messageQueue.length > 0 && (
        <div
          className='flex items-center gap-2 p-2 mb-2 rounded-lg text-xs'
          style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--juhe-amber)' }}
        >
          <WifiOff className='w-3.5 h-3.5 shrink-0' />
          <span>
            {t('network.queuedMessages')} ({messageQueue.length})
          </span>
        </div>
      )}
      {isSendingQueued && (
        <div
          className='flex items-center gap-2 p-2 mb-2 rounded-lg text-xs'
          style={{ background: 'rgba(0,240,255,0.08)', color: 'var(--juhe-cyan)' }}
        >
          <Loader2 className='w-3.5 h-3.5 animate-spin shrink-0' />
          <span>{t('network.reconnecting')}</span>
        </div>
      )}

      {/* Inputbar Container */}
      {/** biome-ignore lint/correctness/useUniqueElementIds: ignored using `--suppress` */}
      <div
        id='inputbar'
        className={`inputbar-container border rounded-[17px] backdrop-blur-sm transition-all duration-200 ${
          isDragging ? 'border-dashed border-green-500 bg-green-500/5' : ''
        }`}
        style={{ borderColor: 'var(--juhe-border)', background: 'rgba(10,10,16,0.8)' }}
      >
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className='flex flex-wrap gap-2 px-4 pt-3'>
            {attachments.map((att, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                className='relative group flex items-center gap-2 px-2 py-1 rounded-lg bg-[var(--juhe-surface-2)] border border-[var(--juhe-border)] text-xs'
              >
                {att.type === 'image' ? (
                  <>
                    <img src={att.url} alt={att.name} className='w-8 h-8 rounded object-cover' />
                    <span className='max-w-[100px] truncate'>{att.name}</span>
                  </>
                ) : (
                  <>
                    <FileText className='w-4 h-4 text-[var(--juhe-text-3)]' />
                    <span className='max-w-[100px] truncate'>{att.name}</span>
                    <span className='text-[var(--juhe-text-3)]'>{formatSize(att.size)}</span>
                  </>
                )}
                <button
                  type='button'
                  onClick={() => removeAttachment(index)}
                  className='p-0.5 rounded hover:bg-[var(--juhe-magenta)]/10 hover:text-[var(--juhe-magenta)] transition-colors'
                >
                  <X className='w-3 h-3' />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          disabled={isGenerating}
          className='w-full px-4 py-2 bg-transparent text-sm resize-none min-h-[30px] max-h-[200px] focus:outline-none disabled:opacity-50 placeholder:text-[var(--juhe-text-3)]/60 leading-relaxed'
          rows={1}
        />

        {/* Bottom Bar */}
        <div className='flex items-center justify-between px-2 py-1.5 h-10 gap-4'>
          {/* Left Section: Provider/Model selector + Tools */}
          <div className='flex items-center gap-1 flex-1 min-w-0'>
            <select
              value={selectedProviderId}
              onChange={(e) => handleProviderChange(e.target.value)}
              className='text-xs px-2 py-1 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
            >
              {availableProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className='text-xs px-2 py-1 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
            >
              {availableProviders
                .find((p) => p.id === selectedProviderId)
                ?.models.filter((m) => isChatModel(m))
                .map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.displayName || m.name}
                  </option>
                ))}
            </select>

            {/* Quick Phrases */}
            <div className='relative'>
              <button
                type='button'
                ref={quickPhrasesAnchorRef}
                onClick={() => setShowQuickPhrases((v) => !v)}
                disabled={isGenerating}
                className='p-1.5 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface)] transition-colors disabled:opacity-50'
                title={t('quickPhrases.title')}
              >
                <Zap className='w-4 h-4' />
              </button>
              <QuickPhrasesPopover
                isOpen={showQuickPhrases}
                onClose={() => setShowQuickPhrases(false)}
                onSelect={(text) => {
                  setContent((prev) => {
                    const newContent = prev + text
                    // 自动调整高度
                    setTimeout(() => {
                      if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto'
                        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
                      }
                    }, 0)
                    return newContent
                  })
                }}
                anchorRef={quickPhrasesAnchorRef}
              />
            </div>

            {/* Web Search */}
            <WebSearchButton disabled={isGenerating} />

            {/* Attachment buttons */}
            <button
              type='button'
              onClick={() => imageInputRef.current?.click()}
              disabled={isGenerating}
              className='p-1.5 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface)] transition-colors disabled:opacity-50'
              title={t('chat.addImage')}
            >
              <ImagePlus className='w-4 h-4' />
            </button>
            <input
              ref={imageInputRef}
              type='file'
              accept='image/*'
              multiple
              className='hidden'
              onChange={handleImageSelect}
            />
            <input ref={fileInputRef} type='file' multiple className='hidden' onChange={handleFileSelect} />
          </div>

          {/* Right Section: Send/Pause button */}
          <div className='flex items-center gap-1.5'>
            {isGenerating ? (
              <button
                type='button'
                onClick={handleStop}
                className='flex items-center justify-center w-8 h-8 rounded-full bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)] hover:bg-[var(--juhe-magenta)]/20 transition-colors'
                title={t('chat.stop')}
              >
                <CirclePause className='w-4 h-4' />
              </button>
            ) : (
              <button
                type='button'
                onClick={handleSend}
                disabled={isSendDisabled}
                className='flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90 disabled:opacity-40 disabled:hover:bg-gradient-to-br transition-colors'
                title={t('chat.send')}
              >
                <Send className='w-4 h-4' />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
