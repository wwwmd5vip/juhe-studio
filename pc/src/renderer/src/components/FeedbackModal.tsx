import { Loader2, MessageSquare, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { error as toastError, success as toastSuccess } from '@/components/ui/toast'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
}

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const { t } = useTranslation()
  const [type, setType] = useState<'bug' | 'feature' | 'other'>('bug')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const appVersion = navigator.userAgent.match(/CherryStudio\/([\d.]+)/)?.[1] || '0.1.0'
  const platform = (() => {
    const p = navigator.platform || ''
    if (p.includes('Win')) return 'Windows'
    if (p.includes('Mac')) return 'macOS'
    if (p.includes('Linux')) return 'Linux'
    return p
  })()

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return

    setSubmitting(true)
    try {
      await window.api.feedback.submit({
        type,
        title: title.trim(),
        content: content.trim(),
        contact: contact.trim() || undefined
      })
      toastSuccess({ title: t('feedback.success') })
      handleClose()
    } catch (err) {
      console.error('[Feedback] Submit error:', err)
      toastError({ title: t('feedback.error') })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setTitle('')
    setContent('')
    setContact('')
    setType('bug')
    onClose()
  }

  const isValid = title.trim().length > 0 && content.trim().length > 0

  if (!open) return null

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='relative w-full max-w-lg mx-4 bg-[var(--juhe-surface)] rounded-2xl shadow-2xl border border-[var(--juhe-border)]'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-[var(--juhe-border)]'>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'>
              <MessageSquare size={18} />
            </div>
            <h2 className='text-base font-semibold text-[var(--juhe-text)]'>{t('feedback.title')}</h2>
          </div>
          <button
            type='button'
            onClick={handleClose}
            className='p-1.5 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className='px-6 py-4 space-y-4'>
          {/* Type selector */}
          <div>
            <label className='block text-sm font-medium text-[var(--juhe-text)] mb-2'>{t('feedback.type')}</label>
            <div className='flex gap-2'>
              {(['bug', 'feature', 'other'] as const).map((opt) => (
                <button
                  type='button'
                  key={opt}
                  onClick={() => setType(opt)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    type === opt
                      ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                      : 'bg-[var(--juhe-void-3)] hover:bg-[var(--juhe-void-3)]/80 text-[var(--juhe-text-3)]'
                  }`}
                >
                  {t(`feedback.${opt === 'bug' ? 'bugReport' : opt === 'feature' ? 'featureRequest' : 'other'}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor='feedback-title' className='block text-sm font-medium text-[var(--juhe-text)] mb-1.5'>
              {t('feedback.title')}
              <span className='text-[var(--juhe-magenta)] ml-0.5'>*</span>
            </label>
            <input
              id='feedback-title'
              type='text'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('feedback.titlePlaceholder')}
              className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                         focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)] placeholder:text-[var(--juhe-text-3)]'
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor='feedback-description' className='block text-sm font-medium text-[var(--juhe-text)] mb-1.5'>
              {t('feedback.description')}
              <span className='text-[var(--juhe-magenta)] ml-0.5'>*</span>
            </label>
            <textarea
              id='feedback-description'
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('feedback.descriptionPlaceholder')}
              rows={5}
              className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                         focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)] placeholder:text-[var(--juhe-text-3)]
                         resize-vertical min-h-[120px]'
              maxLength={5000}
            />
          </div>

          {/* Contact */}
          <div>
            <label htmlFor='feedback-contact' className='block text-sm font-medium text-[var(--juhe-text)] mb-1.5'>{t('feedback.contact')}</label>
            <input
              id='feedback-contact'
              type='text'
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('feedback.contactPlaceholder')}
              className='w-full px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm
                         focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)] placeholder:text-[var(--juhe-text-3)]'
              maxLength={200}
            />
          </div>

          {/* Auto-filled info */}
          <div className='flex gap-4 text-xs text-[var(--juhe-text-3)]'>
            <div className='flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--juhe-void-3)]/40'>
              <span className='opacity-60'>{t('feedback.version')}:</span>
              <span className='font-mono text-[var(--juhe-text)]'>{appVersion}</span>
            </div>
            <div className='flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--juhe-void-3)]/40'>
              <span className='opacity-60'>{t('feedback.os')}:</span>
              <span className='font-mono text-[var(--juhe-text)]'>{platform}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='px-6 py-4 border-t border-[var(--juhe-border)] flex justify-end gap-3'>
          <button
            type='button'
            onClick={handleClose}
            className='px-4 py-2 rounded-lg text-sm font-medium text-[var(--juhe-text-3)] hover:bg-[var(--juhe-surface-2)] transition-colors border border-[var(--juhe-border)]'
          >
            {t('common.cancel')}
          </button>
          <button
            type='button'
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className='px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2'
          >
            {submitting && <Loader2 className='w-4 h-4 animate-spin' />}
            {submitting ? t('feedback.submitting') : t('feedback.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}
