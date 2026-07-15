import { useEffect, useState } from 'react'
import { Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react'
import type { GenerationTask } from '@shared/types/generation'

interface QueueDrawerProps {
  /** Only show when there are active tasks */
}

export function QueueDrawer({}: QueueDrawerProps) {
  const [open, setOpen] = useState(false)
  const [tasks, setTasks] = useState<GenerationTask[]>([])

  useEffect(() => {
    // Listen for queue state updates from the main process
    const cleanup = (window.api as any).queue?.onStateChange?.((state: {
      totalTasks: number
      runningCount: number
      pendingCount: number
      completedCount: number
      failedCount: number
    }) => {
      if (state.runningCount > 0 || state.pendingCount > 0) {
        setOpen(true)
      }
    })

    // Listen for task progress updates
    const cleanup2 = (window.api as any).generation?.onProgressBatch?.((_: unknown, batch: any[]) => {
      setTasks((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]))
        for (const t of batch) {
          map.set(t.taskId || t.id, { ...(map.get(t.taskId || t.id) || {}), ...t })
        }
        return Array.from(map.values())
      })
    })

    return () => {
      cleanup?.()
      cleanup2?.()
    }
  }, [])

  const activeTasks = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'processing' || t.status === 'submitting'
  )
  const recentTasks = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed'
  ).slice(0, 10)

  if (!open && activeTasks.length === 0) return null

  return (
    <>
      {/* Floating toggle */}
      {!open && activeTasks.length > 0 && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-50 bg-cos-accent text-white px-4 py-2
                     rounded-full shadow-cos-overlay text-sm font-cos-body
                     hover:bg-cos-accent-hover transition-colors"
        >
          {activeTasks.length} active · Queue
        </button>
      )}

      {/* Slide panel */}
      {open && (
        <div className="fixed right-0 top-0 h-full w-72 bg-cos-surface
                        border-l border-cos-border shadow-cos-panel z-40
                        flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-cos-border shrink-0">
            <h3 className="font-cos-heading text-sm text-cos-ink">Task Queue</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-cos-ink-muted hover:text-cos-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active tasks */}
          <div className="flex-1 overflow-y-auto">
            {activeTasks.length === 0 && recentTasks.length === 0 && (
              <p className="text-xs text-cos-ink-muted text-center mt-12">No tasks</p>
            )}

            {activeTasks.map((task) => (
              <div key={task.id} className="p-3 border-b border-cos-border">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-cos-accent animate-spin shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-cos-ink truncate">
                      {task.params?.prompt?.slice(0, 40) || task.type}
                    </p>
                    <p className="text-[10px] text-cos-ink-muted">
                      {task.stage} · {task.progress}%
                    </p>
                  </div>
                </div>
                {/* Mini progress bar */}
                <div className="mt-1.5 h-1 bg-cos-bg-alt rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cos-accent rounded-full transition-all duration-300"
                    style={{ width: `${task.progress || 0}%` }}
                  />
                </div>
              </div>
            ))}

            {recentTasks.map((task) => (
              <div key={task.id} className="p-3 border-b border-cos-border/50 opacity-70">
                <div className="flex items-center gap-2">
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-cos-success shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-cos-error shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-cos-ink truncate">
                      {task.params?.prompt?.slice(0, 40) || task.type}
                    </p>
                    <p className="text-[10px] text-cos-ink-muted">
                      {task.status}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
