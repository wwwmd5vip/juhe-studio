/**
 * SafeImage —— <img> 的占位垫片：
 * - 当 src（例如 juhe-image://…）加载失败（404、文件丢失、网络出错等）
 *   时显示一个友好的"图片已丢失"占位块，而不是空白。
 * - 与原 <img> 行为兼容：透传所有 native 属性 + className。
 *
 * 典型用途：渲染 main 进程里 markMissingImageFiles 已经标记为 failed
 * 但 result_urls JSON 里仍残留的 juhe-image:// URL —— DB 修不了，
 * UI 上至少显示一个明确的丢失标记，而不是默默 404。
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** 自定义占位文案 */
  fallbackText?: string
}

export function SafeImage({ src, alt, className, fallbackText, onError, ...rest }: SafeImageProps) {
  const [errored, setErrored] = useState(false)

  if (errored || !src) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1 bg-[var(--juhe-surface)]/40 border border-dashed border-[var(--juhe-border)]/60 rounded text-[var(--juhe-text-muted)] text-xs select-none',
          className
        )}
        role='img'
        aria-label={alt ?? 'image-not-available'}
      >
        <span className='text-base leading-none opacity-70'>🖼️</span>
        <span>{fallbackText ?? '图片已丢失'}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        setErrored(true)
        onError?.(e)
      }}
      {...rest}
    />
  )
}
