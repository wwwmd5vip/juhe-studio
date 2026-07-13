/**
 * UsePromptDialog — choose how to apply an agent/package prompt.
 *
 * Offers two options:
 * - Apply to chat: creates a new chat session with the rendered content as system prompt
 * - Apply to agent: navigates to /agents with systemPrompt URL param
 */

import { Bot, MessageSquare, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface UsePromptDialogProps {
  open: boolean
  content: string
  onApplyToChat: (content: string) => void
  onApplyToAgent: (content: string) => void
  onClose: () => void
}

export default function UsePromptDialog({ open, content, onApplyToChat, onApplyToAgent, onClose }: UsePromptDialogProps) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <button type='button' className='absolute inset-0 bg-black/70' aria-label='Close' onClick={onClose} />
      <div className='relative max-w-sm w-full rounded-2xl bg-[var(--juhe-surface)] border border-[var(--juhe-border)] shadow-2xl overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
          <h2 className='text-sm font-semibold text-[var(--juhe-text)]'>{t('prompts.applyToTitle')}</h2>
          <button
            type='button'
            onClick={onClose}
            className='p-1.5 rounded-md text-[var(--juhe-text-3)] hover:text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] transition-colors'
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Body */}
        <div className='p-4 space-y-2'>
          <button
            type='button'
            onClick={() => onApplyToChat(content)}
            className='w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--juhe-surface-2)] border border-[var(--juhe-border)] hover:border-[var(--juhe-cyan)]/40 hover:bg-[var(--juhe-cyan)]/5 transition-all text-left'
          >
            <div className='w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)]/20 to-[var(--juhe-violet)]/20 flex items-center justify-center shrink-0'>
              <MessageSquare className='w-4 h-4 text-[var(--juhe-cyan)]' />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-medium text-[var(--juhe-text)]'>{t('prompts.applyToChat')}</p>
              <p className='text-[11px] text-[var(--juhe-text-3)] line-clamp-1'>{t('prompts.applyToChatDesc')}</p>
            </div>
          </button>

          <button
            type='button'
            onClick={() => onApplyToAgent(content)}
            className='w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--juhe-surface-2)] border border-[var(--juhe-border)] hover:border-[var(--juhe-violet)]/40 hover:bg-[var(--juhe-violet)]/5 transition-all text-left'
          >
            <div className='w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--juhe-violet)]/20 to-[var(--juhe-magenta)]/20 flex items-center justify-center shrink-0'>
              <Bot className='w-4 h-4 text-[var(--juhe-violet)]' />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-medium text-[var(--juhe-text)]'>{t('prompts.applyToAgent')}</p>
              <p className='text-[11px] text-[var(--juhe-text-3)] line-clamp-1'>{t('prompts.applyToAgentDesc')}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
