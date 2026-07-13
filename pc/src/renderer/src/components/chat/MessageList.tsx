/**
 * 消息列表组件
 * 1:1 复刻 Cherry Studio 的 Messages 容器架构
 *
 * 核心设计：
 * - flex-direction: column-reverse 让最新消息在底部
 * - 数据层倒序：[msg4, msg3, msg2, msg1]
 * - 渲染层 column-reverse：视觉上 msg1(上) → msg2 → msg3 → msg4(下)
 * - 滚动到底部 = scrollTo({ top: 0 })，浏览器原生保持
 *
 * DOM 稳定性原则：
 * - column-reverse 容器内只保留一种子节点结构（消息列表）
 * - 空状态、加载指示器等条件渲染移出容器，避免 React diff 冲突
 * - 所有动态列表项使用稳定 key
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '@/stores/chat'
import { MessageItem } from './MessageItem'

export function MessageList() {
  const { messages, activeSessionId, isGenerating, streamingContent, regenerateMessage, deleteMessage, editMessage } =
    useChatStore()
  const { t } = useTranslation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const userScrollThreshold = 80 // px threshold to detect user scroll

  // Cherry Studio: scrollTo({ top: 0 }) = 底部（因为 column-reverse）
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current && !userScrolledUp) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0 })
        }
      })
    }
  }, [userScrolledUp])

  // 发送消息后自动滚动到底部
  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  // 流式内容更新时保持底部（除非用户已向上滚动）
  useEffect(() => {
    if (isGenerating && scrollContainerRef.current && !userScrolledUp) {
      scrollContainerRef.current.scrollTo({ top: 0 })
    }
  }, [isGenerating, userScrolledUp])

  // 监听用户滚动
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return
    // In column-reverse, scrollTop = 0 means at bottom
    // scrollTop > 0 means user scrolled up
    const scrollTop = scrollContainerRef.current.scrollTop
    if (scrollTop > userScrollThreshold) {
      setUserScrolledUp(true)
    } else if (scrollTop < 10) {
      setUserScrolledUp(false)
    }
  }, [])

  // 处理重新生成
  const handleRegenerate = useCallback(
    (messageId: string) => {
      regenerateMessage(messageId)
    },
    [regenerateMessage]
  )

  // 处理编辑
  const handleEdit = useCallback(
    (messageId: string, content: string) => {
      editMessage(messageId, content)
    },
    [editMessage]
  )

  // 处理删除
  const handleDelete = useCallback(
    (messageId: string) => {
      deleteMessage(messageId)
    },
    [deleteMessage]
  )

  if (!activeSessionId) {
    return (
      <div className='flex-1 flex items-center justify-center text-[var(--juhe-text-3)]'>
        <div className='text-center space-y-3'>
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
          <svg
            className='w-12 h-12 mx-auto text-[var(--juhe-text-3)]/30'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1.5}
              d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
            />
          </svg>
          <p>{t('chat.selectChat')}</p>
        </div>
      </div>
    )
  }

  // Cherry Studio: 消息倒序排列用于 column-reverse
  // 原始: [msg1(最早), msg2, msg3, msg4(最新)]
  // 倒序: [msg4(最新), msg3, msg2, msg1(最早)]
  // column-reverse 渲染后视觉: msg1(上) → msg2 → msg3 → msg4(下)
  const reversedMessages = [...messages].reverse()

  const hasMessages = messages.length > 0
  const showLoadingIndicator = isGenerating && messages[messages.length - 1]?.role !== 'assistant'

  return (
    <div className='flex-1 flex flex-col min-h-0 relative'>
      {/* ==== 空状态：在 column-reverse 容器外部渲染，避免 DOM 结构突变 ==== */}
      {!hasMessages && !isGenerating && (
        <div className='absolute inset-0 flex items-center justify-center text-[var(--juhe-text-3)] text-sm pointer-events-none'>
          {t('chat.sendMessage')}
        </div>
      )}

      {/* ==== 消息列表容器：column-reverse，内部结构保持单一稳定 ==== */}
      {/** biome-ignore lint/correctness/useUniqueElementIds: ignored using `--suppress` */}
      <div
        ref={scrollContainerRef}
        id='messages'
        className='flex-1 flex flex-col-reverse overflow-y-auto overflow-x-hidden min-h-0 relative'
        onScroll={handleScroll}
      >
        {/* 消息列表 - 单一结构，始终渲染 div 容器，内部条件渲染消息 */}
        <div className='flex flex-col-reverse p-3 pb-5'>
          {hasMessages &&
            reversedMessages.map((msg, index) => {
              const isLast = index === 0 // 倒序后第一个是最新消息
              const streamText = streamingContent[msg.id]

              // 如果有流式内容，合并到消息中（同时更新 content 和 blocks）
              let displayMessage = msg
              if (streamText) {
                displayMessage = {
                  ...msg,
                  content: streamText,
                  blocks: msg.blocks?.map((b) => (b.type === 'main_text' ? { ...b, content: streamText } : b))
                }
              }

              return (
                <MessageItem
                  key={msg.id}
                  message={displayMessage}
                  isLast={isLast}
                  onRegenerate={handleRegenerate}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )
            })}
        </div>

        {/* 占位填充：将消息推到底部（当消息较少时） */}
        <div className='flex-1' />
      </div>

      {/* ==== 加载指示器：在 column-reverse 容器外部渲染 ==== */}
      {showLoadingIndicator && (
        <div className='flex gap-3 py-4 px-4 border-t border-[var(--juhe-border)]/50'>
          <div className='w-8 h-8 rounded-full bg-[var(--juhe-surface-2)] flex items-center justify-center border border-[var(--juhe-border)]'>
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
            <svg className='w-4 h-4 animate-spin' fill='none' viewBox='0 0 24 24'>
              <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
              <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
            </svg>
          </div>
          <div className='flex items-center'>
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
        </div>
      )}

      {/* ==== 用户滚动后显示"回到底部"提示 ==== */}
      {userScrolledUp && isGenerating && (
        <button
          type='button'
          onClick={() => {
            setUserScrolledUp(false)
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className='absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full text-xs font-medium
                     bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)] border border-[var(--juhe-cyan)]/30
                     hover:bg-[var(--juhe-cyan)]/20 transition-colors flex items-center gap-1.5'
        >
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
          <svg className='w-3 h-3' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 14l-7 7m0 0l-7-7m7 7V3' />
          </svg>
          新消息
        </button>
      )}
    </div>
  )
}
