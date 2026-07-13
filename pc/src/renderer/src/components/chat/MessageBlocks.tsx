/**
 * 消息 Block 渲染组件
 * 1:1 复刻 Cherry Studio 的 MessageBlockRenderer 架构
 */

import {
  type ChatMessage,
  type CodeMessageBlock,
  type ErrorMessageBlock,
  type FileMessageBlock,
  type ImageMessageBlock,
  type MainTextMessageBlock,
  type MessageBlock,
  MessageBlockStatus,
  MessageBlockType,
  type ThinkingMessageBlock,
  type ToolMessageBlock
} from '@shared/types/chat'
import type { WebSearchResult } from '@shared/types/websearch'
import { AlertTriangle, Check, CheckCircle, Copy, FileText, Lightbulb, Wrench, X } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { classifyError } from '@/utils/errorClassifier'
import { CitationsList } from './CitationsList'
import { MarkdownRenderer } from './MarkdownRenderer'

// ============ 动画包装器 ============
interface AnimatedBlockWrapperProps {
  children: React.ReactNode
  enableAnimation?: boolean
}

function AnimatedBlockWrapper({ children, enableAnimation }: AnimatedBlockWrapperProps) {
  // 使用 CSS keyframes 动画替代 tailwindcss-animate 的 animate-in 类
  // 避免 React DOM diff 与 CSS 动画类冲突导致的 removeChild 错误
  return (
    <div
      className={`block-wrapper ${enableAnimation ? 'block-fade-in' : ''}`}
      style={enableAnimation ? { animation: 'blockFadeIn 0.2s ease-out' } : undefined}
    >
      {children}
    </div>
  )
}

// ============ 主文本块 ============
interface MainTextBlockProps {
  block: MainTextMessageBlock
  message: ChatMessage
}

function MainTextBlockRenderer({ block, message }: MainTextBlockProps) {
  const isUser = message.role === 'user'
  const isStreaming = block.status === MessageBlockStatus.STREAMING

  if (isUser) {
    return <div className='text-sm leading-relaxed whitespace-pre-wrap'>{block.content}</div>
  }

  return (
    <div className='relative'>
      <MarkdownRenderer content={block.content} />
      {/* 流式输出时的闪烁光标 */}
      {isStreaming && (
        <span className='inline-block w-[2px] h-[1.2em] bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] ml-0.5 align-middle animate-pulse' />
      )}
    </div>
  )
}

// ============ 思考过程块 ============
interface ThinkingBlockProps {
  block: ThinkingMessageBlock
}

function ThinkingBlockRenderer({ block }: ThinkingBlockProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const isThinking = block.status === MessageBlockStatus.STREAMING

  const thinkingTimeSeconds = useMemo(() => {
    const ms = block.thinking_millsec || 0
    return (ms / 1000).toFixed(1)
  }, [block.thinking_millsec])

  const handleCopy = useCallback(() => {
    if (block.content) {
      navigator.clipboard.writeText(block.content).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }, [block.content])

  if (!block.content) return null

  return (
    <div className='my-2 rounded-lg border border-[var(--juhe-border)]/50 bg-[var(--juhe-surface-2)]/30 overflow-hidden'>
      {/* Header - 可折叠 */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div
        className='flex items-center gap-2 px-3 py-2 bg-[var(--juhe-surface-2)]/50 border-b border-[var(--juhe-border)]/50 cursor-pointer select-none'
        onClick={() => setIsExpanded((v) => !v)}
      >
        <Lightbulb size={14} className={`text-[var(--juhe-cyan)] shrink-0 ${isThinking ? 'animate-pulse' : ''}`} />
        <span className='text-xs font-medium text-[var(--juhe-text-3)]'>
          {isThinking
            ? t('chat.thinking', { seconds: thinkingTimeSeconds })
            : t('chat.deeplyThought', { seconds: thinkingTimeSeconds })}
        </span>
        {isThinking && (
          <div className='ml-auto flex gap-1'>
            <div
              className='w-1.5 h-1.5 rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] animate-bounce'
              style={{ animationDelay: '0ms' }}
            />
            <div
              className='w-1.5 h-1.5 rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] animate-bounce'
              style={{ animationDelay: '150ms' }}
            />
            <div
              className='w-1.5 h-1.5 rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] animate-bounce'
              style={{ animationDelay: '300ms' }}
            />
          </div>
        )}
        {!isThinking && (
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
            className='ml-auto p-1 rounded hover:bg-[var(--juhe-surface-2)] transition-colors'
            title={t('common.copy')}
          >
            {copied ? (
              <Check size={12} className='text-[var(--juhe-cyan)]' />
            ) : (
              <Copy size={12} className='text-[var(--juhe-text-3)]' />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className='px-3 py-2 text-xs text-[var(--juhe-text-3)] leading-relaxed whitespace-pre-wrap'>
          {block.content}
        </div>
      )}
    </div>
  )
}

// ============ 错误块 ============
interface ErrorBlockProps {
  block: ErrorMessageBlock
  message: ChatMessage
}

function ErrorBlockRenderer({ block, message }: ErrorBlockProps) {
  const { t } = useTranslation()
  const classification = useMemo(
    () => classifyError(block.error, message.providerId || block.error?.providerId),
    [block.error, message.providerId]
  )

  return (
    <div
      className='group relative my-2 cursor-pointer rounded-lg border px-3.5 py-3 text-[13px] transition-all duration-200 hover:border-[color-mix(in_srgb,hsl(var(--destructive))_35%,transparent)] hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_7%,transparent)]'
      style={{
        borderColor: 'color-mix(in srgb, hsl(var(--destructive)) 20%, transparent)',
        background: 'color-mix(in srgb, hsl(var(--destructive)) 4%, transparent)'
      }}
    >
      {/* Close button */}
      <button
        type='button'
        className='absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded border-none bg-transparent opacity-0 transition-all duration-150 hover:bg-[var(--juhe-magenta)]/10 hover:text-[var(--juhe-magenta)] group-hover:opacity-100'
        aria-label='close'
      >
        <X size={14} />
      </button>

      {/* Header: icon + title */}
      <div className='mb-1.5 flex items-center gap-2'>
        <div className='flex shrink-0 items-center justify-center text-[var(--juhe-magenta)]'>
          <AlertTriangle size={15} />
        </div>
        <div className='pr-5 font-semibold text-[13px] leading-[1.4] text-[var(--juhe-magenta)]'>
          {t(classification.i18nKey)}
        </div>
      </div>

      {/* Description */}
      <div className='ml-6 line-clamp-3 text-xs leading-normal text-[var(--juhe-text-3)]'>
        {block.error?.message || t('error.unknown')}
        {block.error?.status && <span className='ml-1 text-[var(--juhe-magenta)]/70'>({block.error.status})</span>}
      </div>

      {/* Footer */}
      {classification.navTarget && (
        <div className='mt-2.5 ml-6 flex items-center gap-2'>
          <a
            href={classification.navTarget}
            className='inline-flex items-center gap-1 rounded-[5px] border border-destructive/25 px-2 py-1 text-xs text-[var(--juhe-magenta)] hover:border-destructive transition-colors'
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg className='w-3 h-3' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37-2.37a1.724 1.724 0 00-2.572-1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
              />
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
            </svg>
            {t('error.goToSettings')}
          </a>
        </div>
      )}
    </div>
  )
}

// ============ 工具块 ============
interface ToolBlockProps {
  block: ToolMessageBlock
}

function ToolBlockRenderer({ block }: ToolBlockProps) {
  const { t } = useTranslation()
  const isSuccess = block.status === MessageBlockStatus.SUCCESS
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className='my-2 rounded-lg border border-[var(--juhe-border)]/50 bg-[var(--juhe-surface-2)]/20 overflow-hidden'>
      {/* Header */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div
        className='flex items-center gap-2 px-3 py-2 bg-[var(--juhe-surface-2)]/50 border-b border-[var(--juhe-border)]/50 cursor-pointer select-none'
        onClick={() => setIsExpanded((v) => !v)}
      >
        <Wrench size={14} className='text-[var(--juhe-text-3)] shrink-0' />
        <span className='text-xs font-medium text-[var(--juhe-text-3)]'>
          {t('chat.toolCall')}: {block.toolName || block.toolId}
        </span>
        {isSuccess && <CheckCircle size={14} className='text-green-500 ml-auto shrink-0' />}
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          {block.arguments && (
            <div className='px-3 py-2 text-xs text-[var(--juhe-text-3)] border-b border-[var(--juhe-border)]/30'>
              <div className='text-[10px] uppercase tracking-wider text-[var(--juhe-text-3)]/60 mb-1'>Input</div>
              <pre className='whitespace-pre-wrap overflow-x-auto bg-[var(--juhe-surface-2)]/30 rounded p-2'>
                {JSON.stringify(block.arguments, null, 2)}
              </pre>
            </div>
          )}
          {block.content && (
            <div className='px-3 py-2 text-xs'>
              <div className='text-[10px] uppercase tracking-wider text-[var(--juhe-text-3)]/60 mb-1'>Output</div>
              <pre className='whitespace-pre-wrap overflow-x-auto bg-[var(--juhe-surface-2)]/30 rounded p-2 text-[var(--juhe-text)]'>
                {typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============ 图片块 ============
interface ImageBlockProps {
  block: ImageMessageBlock
  isSingle?: boolean
}

function ImageBlockRenderer({ block, isSingle = false }: ImageBlockProps) {
  if (block.status === MessageBlockStatus.PENDING) {
    return (
      <div
        className='my-2 flex items-center justify-center bg-[var(--juhe-surface-2)]/30 rounded-lg'
        style={{ width: 200, height: 200 }}
      >
        <div className='flex gap-1'>
          <div
            className='w-2 h-2 rounded-full bg-[var(--juhe-surface-2)]-foreground/50 animate-bounce'
            style={{ animationDelay: '0ms' }}
          />
          <div
            className='w-2 h-2 rounded-full bg-[var(--juhe-surface-2)]-foreground/50 animate-bounce'
            style={{ animationDelay: '150ms' }}
          />
          <div
            className='w-2 h-2 rounded-full bg-[var(--juhe-surface-2)]-foreground/50 animate-bounce'
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    )
  }

  const src = block.url || block.file?.url || ''
  if (!src) return null

  return (
    <div className='my-2'>
      <img
        src={src}
        alt={block.metadata?.prompt || 'Image'}
        className='rounded-lg border border-[var(--juhe-border)]/50'
        style={
          isSingle ? { maxWidth: 500, maxHeight: 'min(500px, 50vh)' } : { width: 280, height: 280, objectFit: 'cover' }
        }
        loading='lazy'
      />
    </div>
  )
}

// ============ 文件块 ============
interface FileBlockProps {
  block: FileMessageBlock
}

function FileBlockRenderer({ block }: FileBlockProps) {
  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className='my-2 flex items-center gap-3 p-3 rounded-lg border border-[var(--juhe-border)]/50 bg-[var(--juhe-surface-2)]/20'>
      <FileText size={20} className='text-[var(--juhe-text-3)] shrink-0' />
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-medium truncate'>{block.file.name}</div>
        {block.file.size && <div className='text-xs text-[var(--juhe-text-3)]'>{formatSize(block.file.size)}</div>}
      </div>
    </div>
  )
}

// ============ 代码块 ============
interface CodeBlockProps {
  block: CodeMessageBlock
}

function CodeBlockRenderer({ block }: CodeBlockProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className='my-2 rounded-lg border border-[var(--juhe-border)]/50 overflow-hidden'>
      {block.language && (
        <div className='flex items-center justify-between px-3 py-1.5 bg-zinc-800 border-b border-zinc-700'>
          <span className='text-xs text-zinc-400 font-mono'>{block.language}</span>
          <button
            type='button'
            onClick={handleCopy}
            className='flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors'
          >
            {copied ? (
              <>
                <Check size={12} />
                {t('chat.copied')}
              </>
            ) : (
              <>
                <Copy size={12} />
                {t('chat.copyCode')}
              </>
            )}
          </button>
        </div>
      )}
      <pre className='overflow-x-auto p-4 bg-zinc-900 text-zinc-100 text-sm font-mono leading-relaxed'>
        <code>{block.content}</code>
      </pre>
    </div>
  )
}

// ============ 占位符块（加载中） ============
interface PlaceholderBlockProps {
  isProcessing: boolean
}

function PlaceholderBlockRenderer({ isProcessing }: PlaceholderBlockProps) {
  if (!isProcessing) return null

  return (
    <div className='flex items-center gap-2 h-8'>
      <div className='flex gap-1'>
        <div
          className='w-2 h-2 rounded-full bg-[var(--juhe-surface-2)]-foreground/50 animate-bounce'
          style={{ animationDelay: '0ms' }}
        />
        <div
          className='w-2 h-2 rounded-full bg-[var(--juhe-surface-2)]-foreground/50 animate-bounce'
          style={{ animationDelay: '150ms' }}
        />
        <div
          className='w-2 h-2 rounded-full bg-[var(--juhe-surface-2)]-foreground/50 animate-bounce'
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  )
}

// ============ Block 分组逻辑 ============
type BlockGroup = MessageBlock | MessageBlock[]

function groupSimilarBlocks(blocks: MessageBlock[]): BlockGroup[] {
  return blocks.reduce<BlockGroup[]>((acc, currentBlock) => {
    if (currentBlock.type === MessageBlockType.IMAGE) {
      const prevGroup = acc[acc.length - 1]
      if (Array.isArray(prevGroup) && prevGroup[0].type === MessageBlockType.IMAGE) {
        prevGroup.push(currentBlock)
      } else {
        acc.push([currentBlock])
      }
    } else if (currentBlock.type === MessageBlockType.TOOL) {
      const prevGroup = acc[acc.length - 1]
      if (Array.isArray(prevGroup) && prevGroup[0].type === MessageBlockType.TOOL) {
        prevGroup.push(currentBlock)
      } else {
        acc.push([currentBlock])
      }
    } else {
      acc.push(currentBlock)
    }
    return acc
  }, [])
}

// ============ 主渲染器 ============

interface MessageBlocksProps {
  message: ChatMessage
  isStreaming?: boolean
}

function getSearchResultsFromMessage(message: ChatMessage): WebSearchResult[] | undefined {
  // Try to extract search results from message metadata or blocks
  const citationBlock = message.blocks?.find((b) => b.type === MessageBlockType.CITATION)
  if (citationBlock?.metadata?.searchResults) {
    return citationBlock.metadata.searchResults as WebSearchResult[]
  }
  if (message.blocks && message.blocks.length > 0) {
    const mainText = message.blocks.find((b) => b.type === MessageBlockType.MAIN_TEXT) as
      | MainTextMessageBlock
      | undefined
    if (mainText?.metadata?.searchResults) {
      return mainText.metadata.searchResults as WebSearchResult[]
    }
  }
  return undefined
}

export const MessageBlocks = React.memo(function MessageBlocks({ message, isStreaming }: MessageBlocksProps) {
  const blocks = message.blocks || []
  const isProcessing = message.status === 'sending' || message.status === 'streaming'
  const isAssistant = message.role === 'assistant'

  // 获取 MAIN_TEXT block 的内容长度，用于判断是否显示加载占位符
  const mainTextBlock = blocks.find((b) => b.type === MessageBlockType.MAIN_TEXT) as MainTextMessageBlock | undefined
  const mainTextContent = mainTextBlock?.content || ''

  // Extract search results for citation rendering
  const searchResults = getSearchResultsFromMessage(message)

  // 兼容旧版：没有 blocks 时直接渲染 content
  if (blocks.length === 0) {
    if (message.role === 'user') {
      return <div className='text-sm leading-relaxed whitespace-pre-wrap'>{message.content}</div>
    }
    return (
      <div>
        <MarkdownRenderer content={message.content} />
        {isAssistant && searchResults && searchResults.length > 0 && <CitationsList results={searchResults} />}
      </div>
    )
  }

  const groupedBlocks = groupSimilarBlocks(blocks)

  return (
    <div className='space-y-1'>
      {groupedBlocks.map((group, _groupIndex) => {
        // 数组 = 分组（IMAGE 或 TOOL）
        if (Array.isArray(group)) {
          const groupKey = group.map((b) => b.id).join('-')

          if (group[0].type === MessageBlockType.IMAGE) {
            if (group.length === 1) {
              return (
                <AnimatedBlockWrapper key={groupKey} enableAnimation={isStreaming}>
                  <ImageBlockRenderer block={group[0] as ImageMessageBlock} isSingle={true} />
                </AnimatedBlockWrapper>
              )
            }
            // 多张图片使用网格布局
            return (
              <AnimatedBlockWrapper key={groupKey} enableAnimation={isStreaming}>
                <div className='flex flex-wrap gap-2'>
                  {group.map((imageBlock) => (
                    <ImageBlockRenderer key={imageBlock.id} block={imageBlock as ImageMessageBlock} isSingle={false} />
                  ))}
                </div>
              </AnimatedBlockWrapper>
            )
          }

          if (group[0].type === MessageBlockType.TOOL) {
            if (group.length === 1) {
              return (
                <AnimatedBlockWrapper key={groupKey} enableAnimation={isStreaming}>
                  <ToolBlockRenderer block={group[0] as ToolMessageBlock} />
                </AnimatedBlockWrapper>
              )
            }
            // 多个工具调用分组显示
            return (
              <AnimatedBlockWrapper key={groupKey} enableAnimation={isStreaming}>
                <div className='space-y-1'>
                  {group.map((toolBlock) => (
                    <ToolBlockRenderer key={toolBlock.id} block={toolBlock as ToolMessageBlock} />
                  ))}
                </div>
              </AnimatedBlockWrapper>
            )
          }

          return null
        }

        // 单个 Block
        const block = group
        const key = `${message.id}-${block.id}`

        switch (block.type) {
          case MessageBlockType.MAIN_TEXT:
            return (
              <AnimatedBlockWrapper key={key} enableAnimation={isStreaming}>
                <MainTextBlockRenderer block={block as MainTextMessageBlock} message={message} />
              </AnimatedBlockWrapper>
            )
          case MessageBlockType.THINKING:
            return (
              <AnimatedBlockWrapper key={key} enableAnimation={isStreaming}>
                <ThinkingBlockRenderer block={block as ThinkingMessageBlock} />
              </AnimatedBlockWrapper>
            )
          case MessageBlockType.ERROR:
            return (
              <AnimatedBlockWrapper key={key}>
                <ErrorBlockRenderer block={block as ErrorMessageBlock} message={message} />
              </AnimatedBlockWrapper>
            )
          case MessageBlockType.TOOL:
            return (
              <AnimatedBlockWrapper key={key}>
                <ToolBlockRenderer block={block as ToolMessageBlock} />
              </AnimatedBlockWrapper>
            )
          case MessageBlockType.IMAGE:
            return (
              <AnimatedBlockWrapper key={key}>
                <ImageBlockRenderer block={block as ImageMessageBlock} isSingle={true} />
              </AnimatedBlockWrapper>
            )
          case MessageBlockType.FILE:
            return (
              <AnimatedBlockWrapper key={key}>
                <FileBlockRenderer block={block as FileMessageBlock} />
              </AnimatedBlockWrapper>
            )
          case MessageBlockType.CODE:
            return (
              <AnimatedBlockWrapper key={key}>
                <CodeBlockRenderer block={block as CodeMessageBlock} />
              </AnimatedBlockWrapper>
            )
          default:
            return null
        }
      })}

      {/* 流式加载占位符 - 仅在 MAIN_TEXT 内容为空时显示 */}
      {isProcessing && mainTextContent.length === 0 && (
        <AnimatedBlockWrapper key={`${message.id}-placeholder`} enableAnimation={true}>
          <PlaceholderBlockRenderer isProcessing={isProcessing} />
        </AnimatedBlockWrapper>
      )}

      {/* Citations for assistant messages with search results */}
      {isAssistant && searchResults && searchResults.length > 0 && <CitationsList results={searchResults} />}
    </div>
  )
})
