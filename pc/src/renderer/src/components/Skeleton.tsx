import { cn } from '@/lib/utils'

/**
 * Pulsing placeholder skeleton for loading states.
 * Usage:
 *   <Skeleton className="h-4 w-48" />        — single line
 *   <Skeleton className="h-6 w-full rounded" /> — block
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-[var(--juhe-surface-2)]', className)} />
}

/** Repeated skeleton rows, e.g. for list/table loading placeholders. */
export function SkeletonRows({
  count = 5,
  className = 'h-4 w-full',
  gap = 'gap-3'
}: {
  count?: number
  className?: string
  gap?: string
}) {
  return (
    <div className={`flex flex-col ${gap}`}>
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static array, index is stable
        <Skeleton key={i} className={className} />
      ))}
    </div>
  )
}
