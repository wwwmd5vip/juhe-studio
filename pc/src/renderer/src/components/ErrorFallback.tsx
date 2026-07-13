import { AlertTriangle, Copy, Home, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const err = error instanceof Error ? error : new Error(String(error))

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${err.message}\n\n${err.stack || ''}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may not be available
    }
  }

  return (
    <div className='flex items-center justify-center h-screen w-screen bg-[var(--juhe-bg)]'>
      <div className='text-center max-w-lg p-8'>
        <AlertTriangle className='mx-auto mb-4' size={48} style={{ color: 'var(--juhe-magenta)' }} />
        <h2 className='text-xl font-semibold mb-2' style={{ color: 'var(--juhe-text)' }}>
          {t('error.somethingWentWrong', '页面出错了')}
        </h2>
        <p className='text-sm mb-4' style={{ color: 'var(--juhe-text-2)' }}>
          {err.message}
        </p>
        <pre
          className='text-xs mb-6 text-left p-3 rounded-lg overflow-auto select-all'
          style={{
            color: 'var(--juhe-text-3)',
            maxHeight: '120px',
            backgroundColor: 'var(--juhe-bg-2)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {err.stack?.split('\n').slice(0, 5).join('\n')}
        </pre>
        <div className='flex gap-3 justify-center flex-wrap'>
          <button
            type='button'
            onClick={handleCopy}
            className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors'
            style={{
              color: 'var(--juhe-text)',
              borderColor: 'var(--juhe-border)',
              backgroundColor: 'var(--juhe-bg-2)'
            }}
          >
            {copied ? (
              <span className='text-[var(--juhe-magenta)]'>{t('common.copied', '已复制')}</span>
            ) : (
              <>
                <Copy size={14} />
                {t('common.copy', '复制')}
              </>
            )}
          </button>
          <button
            type='button'
            onClick={resetErrorBoundary}
            className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors'
            style={{ backgroundColor: 'var(--juhe-magenta)' }}
          >
            <RefreshCw size={14} />
            {t('common.retry', '重试')}
          </button>
          <a
            href='/'
            className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors'
            style={{
              color: 'var(--juhe-text)',
              borderColor: 'var(--juhe-border)',
              backgroundColor: 'var(--juhe-bg-2)'
            }}
          >
            <Home size={14} />
            {t('common.home', '首页')}
          </a>
        </div>
      </div>
    </div>
  )
}
