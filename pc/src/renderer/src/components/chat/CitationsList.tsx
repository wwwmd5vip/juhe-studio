/**
 * Citations List Component
 * Renders search citations below assistant messages
 */

import type { WebSearchResult } from '@shared/types/websearch'
import { ChevronDown, ChevronUp, Globe } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface CitationsListProps {
  results: WebSearchResult[]
}

function getHostname(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch (error) {
    console.error('Failed to extract hostname from URL:', url, error)
    return url
  }
}

function getFaviconUrl(url: string): string {
  try {
    const u = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=16`
  } catch (error) {
    console.error('Failed to extract favicon from URL:', url, error)
    return ''
  }
}

export function CitationsList({ results }: CitationsListProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)

  if (!results || results.length === 0) return null

  return (
    <div className='mt-2 rounded-lg border border-[var(--juhe-border)]/50 bg-[var(--juhe-surface-2)]/20 overflow-hidden'>
      {/* Header */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div
        className='flex items-center gap-2 px-3 py-2 bg-[var(--juhe-surface-2)]/50 border-b border-[var(--juhe-border)]/50 cursor-pointer select-none'
        onClick={() => setIsExpanded((v) => !v)}
      >
        <Globe size={14} className='text-[var(--juhe-text-3)] shrink-0' />
        <span className='text-xs font-medium text-[var(--juhe-text-3)]'>
          {t('websearch.results')} ({results.length})
        </span>
        {isExpanded ? (
          <ChevronUp size={14} className='ml-auto text-[var(--juhe-text-3)] shrink-0' />
        ) : (
          <ChevronDown size={14} className='ml-auto text-[var(--juhe-text-3)] shrink-0' />
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className='px-3 py-2 space-y-2'>
          {results.map((result, index) => {
            const hostname = result.hostname || getHostname(result.url)
            const favicon = result.favicon || getFaviconUrl(result.url)

            return (
              <a
                // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                key={index}
                href={result.url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-start gap-2 p-2 rounded-md hover:bg-[var(--juhe-surface-2)]/50 transition-colors group'
              >
                {favicon ? (
                  <img
                    src={favicon}
                    alt=''
                    className='w-4 h-4 rounded-sm mt-0.5 shrink-0'
                    loading='lazy'
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <Globe size={16} className='mt-0.5 shrink-0 text-[var(--juhe-text-3)]' />
                )}
                <div className='min-w-0 flex-1'>
                  <div className='text-xs font-medium text-[var(--juhe-text)] truncate group-hover:underline'>
                    {result.title || hostname}
                  </div>
                  <div className='text-[10px] text-[var(--juhe-text-3)] truncate'>{hostname}</div>
                  {result.content && (
                    <div className='text-[11px] text-[var(--juhe-text-3)] mt-0.5 line-clamp-2'>{result.content}</div>
                  )}
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
