/**
 * Masonry 瀑布流组件
 * 参考 Image-Prompts 的瀑布流布局，使用 CSS columns 实现
 * 支持响应式列数（移动端1列，桌面端2列，大屏3列）
 */

import { type ReactNode, useEffect, useRef, useState } from 'react'

interface MasonryProps {
  children: ReactNode
  className?: string
  gap?: number
  columnWidth?: number // 目标列宽，用于计算列数
}

export function Masonry({ children, className = '', gap = 8, columnWidth = 280 }: MasonryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(2)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateColumns = () => {
      const width = el.clientWidth
      // 移动端 < 480: 1列; 桌面 480-960: 2列; 大屏 > 960: 3列
      let count = Math.max(1, Math.floor((width + gap) / (columnWidth + gap)))
      if (width < 480) count = 1
      else if (width < 960) count = 2
      else count = Math.min(3, count)
      setColumnCount(count)
    }

    updateColumns()
    const ro = new ResizeObserver(updateColumns)
    ro.observe(el)
    return () => ro.disconnect()
  }, [gap, columnWidth])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        columnCount,
        columnGap: `${gap}px`
      }}
    >
      {children}
    </div>
  )
}

/**
 * MasonryItem — 瀑布流子项
 * 必须包裹 break-inside: avoid 防止元素被截断
 */
interface MasonryItemProps {
  children: ReactNode
  className?: string
  gap?: number
}

export function MasonryItem({ children, className = '', gap = 8 }: MasonryItemProps) {
  return (
    <div
      className={className}
      style={{
        breakInside: 'avoid',
        marginBottom: `${gap}px`
      }}
    >
      {children}
    </div>
  )
}
