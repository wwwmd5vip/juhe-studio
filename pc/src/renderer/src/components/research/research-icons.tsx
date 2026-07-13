/**
 * research-icons.tsx — 深度研究模块图标
 */

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.3-4.3' />
    </svg>
  )
}

export function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' />
      <path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' />
    </svg>
  )
}

export function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' />
      <polyline points='14 2 14 8 20 8' />
      <line x1='16' x2='8' y1='13' y2='13' />
      <line x1='16' x2='8' y1='17' y2='17' />
      <line x1='10' x2='8' y1='9' y2='9' />
    </svg>
  )
}

export function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <rect width='14' height='14' x='8' y='8' rx='2' ry='2' />
      <path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' />
    </svg>
  )
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <polyline points='20 6 9 17 4 12' />
    </svg>
  )
}

export function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='m12 3-1.912 5.813a2 2 0 0 1-1.275 1.94L19 12l-5.813 1.912a2 2 0 0 1-1.94 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.94L5 12l5.813-1.912a2 2 0 0 1 1.94-1.275z' />
    </svg>
  )
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M5 12h14' />
      <path d='M12 5v14' />
    </svg>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox='0 0 24 24' fill='none'>
      <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
      <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z' />
    </svg>
  )
}

export function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <circle cx='12' cy='12' r='10' />
      <line x1='12' x2='12' y1='8' y2='12' />
      <line x1='12' x2='12.01' y1='16' y2='16' />
    </svg>
  )
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
      <polyline points='7 10 12 15 17 10' />
      <line x1='12' x2='12' y1='15' y2='3' />
    </svg>
  )
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M3 6h18' />
      <path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' />
      <path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' />
    </svg>
  )
}
