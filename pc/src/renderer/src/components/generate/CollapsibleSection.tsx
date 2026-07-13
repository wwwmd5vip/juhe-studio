import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

interface CollapsibleSectionProps {
  title: React.ReactNode
  defaultExpanded?: boolean
  children: React.ReactNode
  className?: string
  onToggle?: (expanded: boolean) => void
}

export function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
  className = '',
  onToggle
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentId = useId()

  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    onToggle?.(next)
  }

  return (
    <div
      className={`rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] overflow-hidden ${className}`}
    >
      <button
        type='button'
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        className='w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-[var(--juhe-text-2)] uppercase tracking-wider hover:bg-[var(--juhe-surface)]/50 transition-colors'
      >
        <span>{title}</span>
        <ChevronDown
          className='w-3.5 h-3.5 text-[var(--juhe-text-3)] transition-transform duration-200'
          style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
      </button>
      <div
        id={contentId}
        className='grid transition-all duration-200 ease-out'
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className='min-h-0 overflow-hidden'>
          <div className='p-3 pt-0'>{children}</div>
        </div>
      </div>
    </div>
  )
}
