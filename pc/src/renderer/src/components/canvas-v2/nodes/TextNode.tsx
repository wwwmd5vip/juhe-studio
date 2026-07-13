/**
 * TextNode - 文本/提示词节点
 * 可编辑文本、字数统计、字大小调整、"生图"按钮
 */

import { ImageIcon } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasNodeView } from '../CanvasNode'
import type { CanvasTheme } from '../canvas-theme'
import type { CanvasNode, Position } from '../types'

interface TextNodeShellProps {
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
  onDoubleClick?: (nodeId: string) => void
  onContentChange?: (nodeId: string, content: string) => void
  onGenerateImage?: (nodeId: string) => void
}

export function TextNode(props: TextNodeShellProps) {
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
      onContentChange={(id, content) => props.onContentChange?.(id, content)}
      onContextMenu={props.onContextMenu}
      onDoubleClick={props.onDoubleClick}
      renderContent={(node, theme) => (
        <TextNodeContent
          node={node}
          theme={theme}
          onContentChange={props.onContentChange}
          onGenerateImage={props.onGenerateImage}
        />
      )}
    />
  )
}

function TextNodeContent({
  node,
  theme,
  onContentChange,
  onGenerateImage
}: {
  node: CanvasNode
  theme: CanvasTheme
  onContentChange?: (nodeId: string, content: string) => void
  onGenerateImage?: (nodeId: string) => void
}) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fontSize = node.metadata?.fontSize || 14
  const textStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: `${Math.round(fontSize * 1.65)}px`,
    color: theme.node.text,
    boxSizing: 'border-box'
  }
  const content = node.metadata?.content || ''

  useEffect(() => {
    if (!isEditing) return
    textareaRef.current?.focus()
    textareaRef.current?.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length)
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) return
    const handleOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (textareaRef.current?.contains(event.target)) return
      setIsEditing(false)
    }
    window.addEventListener('pointerdown', handleOutside, true)
    return () => window.removeEventListener('pointerdown', handleOutside, true)
  }, [isEditing])

  return (
    <div className='flex h-full w-full flex-col overflow-hidden pt-8'>
      {/* 生图按钮 */}
      {onGenerateImage && (
        <button
          type='button'
          className='absolute right-3 top-3 z-20 inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium opacity-85 backdrop-blur-md transition hover:scale-[1.02] hover:opacity-100'
          style={{ background: `${theme.toolbar.panel}dd`, borderColor: theme.node.stroke, color: theme.node.text }}
          onClick={(e) => {
            e.stopPropagation()
            onGenerateImage(node.id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title={t('canvas.nodeContent.textToImage')}
        >
          <ImageIcon className='size-3.5' />
          {t('canvas.nodeContent.generateImage')}
        </button>
      )}

      {/* 文本区域 */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className='block h-full w-full resize-none overflow-y-auto whitespace-pre-wrap break-words border-none bg-transparent px-4 pb-4 font-mono outline-none'
          style={textStyle}
          value={content}
          onChange={(e) => onContentChange?.(node.id, e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsEditing(false)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        />
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
<div
          className='block h-full w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-4 pb-4 font-mono'
          style={textStyle}
          onDoubleClick={() => setIsEditing(true)}
          onWheel={(e) => e.stopPropagation()}
        >
          {content || (
            <span style={{ color: theme.node.placeholder }}>{t('canvas.nodeContent.doubleClickToEdit')}</span>
          )}
        </div>
      )}

      {/* 字数统计 */}
      <div className='absolute bottom-2 right-3 z-20 text-[10px] opacity-40' style={{ color: theme.node.muted }}>
        {t('canvas.node.charCount', { count: content.length })}
      </div>
    </div>
  )
}
