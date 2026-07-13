import { Check, Copy } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface CopyButtonProps {
  text: string
  className?: string
  size?: number
  showLabel?: boolean
  onCopy?: () => void
}

export function CopyButton({ text, className = '', size = 14, showLabel = false, onCopy }: CopyButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      onCopy?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        onCopy?.()
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Silent fail
      }
      document.body.removeChild(textarea)
    }
  }, [text, onCopy])

  return (
    <button
      type='button'
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] transition-colors ${className}`}
      title={copied ? t('common.copied') : t('common.copy')}
    >
      {copied ? <Check size={size} className='text-green-500' /> : <Copy size={size} />}
      {showLabel && <span className='text-xs'>{copied ? t('common.copied') : t('common.copy')}</span>}
    </button>
  )
}
