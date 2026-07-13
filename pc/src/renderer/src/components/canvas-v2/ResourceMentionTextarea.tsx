/**
 * ResourceMentionTextarea - @[node:ID] 资源引用编辑器
 * 输入 @ 弹出可用节点选择器，选中后插入 @[node:ID] token
 */
import type React from 'react'
import { useCallback, useRef, useState } from 'react'
import { useThemeStore } from '@/stores/theme'
import { type CanvasTheme, canvasThemes } from './canvas-theme'
import type { CanvasResourceReference } from './utils/canvas-reference'

// ---- Props ----

interface ResourceMentionTextareaProps {
  value: string
  references: CanvasResourceReference[]
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  onChange: (value: string) => void
  onBlur?: () => void
  onKeyDown?: (event: React.KeyboardEvent) => void
}

export function ResourceMentionTextarea({
  value,
  references,
  placeholder,
  className,
  style,
  onChange,
  onBlur,
  onKeyDown
}: ResourceMentionTextareaProps) {
  const themeResolved = useThemeStore((s) => s.resolved)
  const theme = canvasThemes[themeResolved]

  const editorRef = useRef<HTMLDivElement>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  const filteredRefs = references.filter(
    (r) =>
      !mentionFilter ||
      r.title.toLowerCase().includes(mentionFilter.toLowerCase()) ||
      r.label.toLowerCase().includes(mentionFilter.toLowerCase())
  )

  // 检测 @ 输入
  const handleInput = useCallback(() => {
    const el = editorRef.current
    if (!el) return

    const text = el.innerText || ''
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const textBeforeCursor = text.slice(0, range.startOffset)

    // 查找最后一个 @ 位置
    const atIndex = textBeforeCursor.lastIndexOf('@')
    if (atIndex !== -1 && atIndex >= textBeforeCursor.length - 30) {
      const filterText = textBeforeCursor.slice(atIndex + 1)
      if (!filterText.includes(' ') && !filterText.includes('\n')) {
        setShowMentions(true)
        setMentionFilter(filterText)
        setMentionIndex(0)

        // 获取光标位置
        const rect = range.getBoundingClientRect()
        setCursorPos({ x: rect.left, y: rect.bottom + 4 })
        return
      }
    }
    setShowMentions(false)

    // 通知外部
    onChange(el.innerText || '')
  }, [onChange])

  // 插入 @[node:ID] token
  const insertMention = useCallback(
    (ref: CanvasResourceReference) => {
      const el = editorRef.current
      if (!el) return

      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return

      const range = selection.getRangeAt(0)
      const textBeforeCursor = el.innerText?.slice(0, range.startOffset) || ''
      const atIndex = textBeforeCursor.lastIndexOf('@')

      if (atIndex !== -1) {
        // 删除 @ 及后面的文本
        const beforeAt = textBeforeCursor.slice(0, atIndex)
        const afterCursor = el.innerText?.slice(range.startOffset) || ''

        // 确定插入哪种 token
        const token = `@[${ref.id}]`
        const newText = beforeAt + token + afterCursor

        // 通过 innerText 更新
        el.innerText = newText

        // 移动光标到 token 之后
        const newRange = document.createRange()
        const textNode = el.firstChild
        if (textNode) {
          newRange.setStart(textNode, beforeAt.length + token.length)
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)
        }

        onChange(newText)
      }

      setShowMentions(false)
    },
    [onChange]
  )

  // 键盘导航
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (showMentions) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setMentionIndex((i) => Math.min(i + 1, filteredRefs.length - 1))
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setMentionIndex((i) => Math.max(i - 1, 0))
          return
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          if (filteredRefs[mentionIndex]) {
            insertMention(filteredRefs[mentionIndex])
          }
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setShowMentions(false)
          return
        }
      }
      onKeyDown?.(event)
    },
    [showMentions, filteredRefs, mentionIndex, insertMention, onKeyDown]
  )

  // 粘贴时清理格式
  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      event.preventDefault()
      const text = event.clipboardData.getData('text/plain')
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(text))
      range.collapse(false)
      // 延迟触发 input 事件
      setTimeout(() => handleInput(), 0)
    },
    [handleInput]
  )

  return (
    <div className='relative h-full w-full'>
      {/* biome-ignore lint/a11y/useSemanticElements: custom interactive element, button semantics not appropriate */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={className}
        style={{
          ...style,
          outline: 'none',
          wordBreak: 'break-word'
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={onBlur}
        data-placeholder={placeholder}
        role='textbox'
        aria-multiline='true'
      >
        {renderContent(value, references, theme)}
      </div>

      {/* Mention dropdown */}
      {showMentions && filteredRefs.length > 0 && cursorPos && (
        <div
          className='fixed z-[150] max-h-48 w-56 overflow-y-auto rounded-lg border py-1 shadow-xl backdrop-blur-md'
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            background: theme.toolbar.panel,
            borderColor: theme.toolbar.border
          }}
        >
          {filteredRefs.map((ref, idx) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
              key={ref.id}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors ${
                idx === mentionIndex ? 'opacity-100' : 'opacity-70'
              }`}
              style={{
                background: idx === mentionIndex ? theme.toolbar.activeBg : 'transparent',
                color: theme.node.text
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                insertMention(ref)
              }}
              onMouseEnter={() => setMentionIndex(idx)}
            >
              {/* 预览图标 */}
              {ref.content && ref.type === 'image' ? (
                <img src={ref.content} alt='' className='size-5 rounded object-cover' />
              ) : (
                <NodeTypeIcon type={ref.type} />
              )}
              <span className='truncate'>{ref.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Chip rendering ----

const TOKEN_REGEX = /@\[(node:[^\]]+)\]/g

function renderContent(text: string, references: CanvasResourceReference[], theme: CanvasTheme): React.ReactNode {
  const refMap = new Map(references.map((r) => [r.id, r]))
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  // biome-ignore lint/suspicious/noAssignInExpressions: ignored using `--suppress`
  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    // Text before token
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const tokenId = match[1]
    const ref = refMap.get(tokenId)

    // Token chip
    parts.push(
      <span
        key={`token-${match.index}`}
        className='inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium align-middle mx-0.5'
        style={{
          background: ref ? '#2f80ff22' : theme.node.stroke,
          color: ref ? '#2f80ff' : theme.node.muted,
          border: `1px solid ${ref ? '#2f80ff44' : 'transparent'}`,
          userSelect: 'none'
        }}
        contentEditable={false}
      >
        {ref?.content && ref.type === 'image' ? (
          <img src={ref.content} alt='' className='size-3.5 rounded object-cover' />
        ) : null}
        {ref?.label || `[${tokenId}]`}
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : text
}

function NodeTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'image':
      return (
        <div className='flex size-5 items-center justify-center rounded bg-emerald-500/20'>
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative SVG, no accessible title needed */}
          <svg
            className='size-3 text-emerald-500'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <rect x='3' y='3' width='18' height='18' rx='2' />
            <circle cx='8.5' cy='8.5' r='1.5' />
            <path d='m21 15-5-5L5 21' />
          </svg>
        </div>
      )
    case 'text':
      return (
        <div className='flex size-5 items-center justify-center rounded bg-amber-500/20'>
          <span className='text-[9px] text-amber-500 font-bold'>T</span>
        </div>
      )
    case 'video':
      return (
        <div className='flex size-5 items-center justify-center rounded bg-orange-500/20'>
          <span className='text-[9px] text-orange-500'>▶</span>
        </div>
      )
    default:
      return (
        <div className='flex size-5 items-center justify-center rounded bg-blue-500/20'>
          <span className='text-[9px] text-blue-500'>?</span>
        </div>
      )
  }
}
