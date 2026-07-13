import { AlertTriangle, X } from 'lucide-react'

export interface ConfirmModalProps {
  open: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='relative w-full max-w-md mx-4 bg-[var(--juhe-surface)] rounded-2xl shadow-2xl border border-[var(--juhe-border)]'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-[var(--juhe-border)]'>
          <div className='flex items-center gap-2.5'>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                danger
                  ? 'bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]'
                  : 'bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
              }`}
            >
              <AlertTriangle size={18} />
            </div>
            <h2 className='text-base font-semibold text-[var(--juhe-text)]'>{title}</h2>
          </div>
          <button
            type='button'
            onClick={onCancel}
            className='p-1.5 rounded-lg text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className='px-6 py-4'>
          <p className='text-sm text-[var(--juhe-text-3)] leading-relaxed'>{description}</p>
        </div>

        {/* Footer */}
        <div className='px-6 py-4 border-t border-[var(--juhe-border)] flex justify-end gap-3'>
          <button
            type='button'
            onClick={onCancel}
            className='px-4 py-2 rounded-lg text-sm font-medium text-[var(--juhe-text-3)] hover:bg-[var(--juhe-surface-2)] transition-colors border border-[var(--juhe-border)]'
          >
            {cancelText}
          </button>
          <button
            type='button'
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] hover:opacity-90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
