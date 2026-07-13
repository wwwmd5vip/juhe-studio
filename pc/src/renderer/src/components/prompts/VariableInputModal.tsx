import { X } from 'lucide-react'
import { useCallback, useState } from 'react'

interface VariableInputModalProps {
  variables: Record<string, string>
  onConfirm: (values: Record<string, string>) => void
  onCancel: () => void
}

export default function VariableInputModal({ variables, onConfirm, onCancel }: VariableInputModalProps) {
  const keys = Object.keys(variables)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const k of keys) {
      init[k] = ''
    }
    return init
  })

  const handleConfirm = useCallback(() => {
    onConfirm(values)
  }, [values, onConfirm])

  const allFilled = keys.every((k) => values[k]?.trim())

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <button type='button' className='absolute inset-0 bg-black/70' aria-label='Close' onClick={onCancel} />
      <div className='relative max-w-md w-full rounded-2xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] shadow-2xl overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
          <h2 className='text-sm font-semibold text-[var(--juhe-text)]'>填写模板变量</h2>
          <button
            type='button'
            onClick={onCancel}
            className='p-1.5 rounded-md text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Body */}
        <div className='p-4 space-y-3 max-h-[60vh] overflow-y-auto'>
          <p className='text-[11px] text-[var(--juhe-text-3)]'>该模板包含 {keys.length} 个变量，请填写实际值：</p>
          {keys.map((key) => (
            <div key={key} className='space-y-1'>
              <label className='text-[11px] font-medium text-[var(--juhe-text-2)]'>{`{{${key}}}`}</label>
              <input
                type='text'
                value={values[key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={variables[key] || '输入值...'}
                className='w-full px-3 py-2 rounded-lg bg-[var(--juhe-void)] border border-[var(--juhe-border)] text-xs text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 transition-all'
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-2 px-4 py-3 border-t border-[var(--juhe-border)]'>
          <button
            type='button'
            onClick={onCancel}
            className='px-3 py-1.5 rounded-lg border border-[var(--juhe-border)] text-xs text-[var(--juhe-text-2)] hover:border-[var(--juhe-cyan)]/30 transition-colors'
          >
            取消
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={!allFilled}
            className='px-4 py-1.5 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed'
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
