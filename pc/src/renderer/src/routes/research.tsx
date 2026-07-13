import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@cherrystudio/ui'
import type { RendererAPI } from '@shared/types/ipc'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import { TaskModelSelector, type TaskModelSelectorValue } from '@/components/common/TaskModelSelector'
import { AlertCircleIcon, BookOpenIcon, CheckIcon, CopyIcon, DownloadIcon, FileTextIcon, PlusIcon, SearchIcon, SparklesIcon, Spinner, TrashIcon } from '@/components/research/research-icons'
import { type ResearchRound, useResearchStore } from '@/stores/research'

const api = (window as unknown as { api: RendererAPI }).api

export const Route = createFileRoute('/research')({
  component: ResearchPage
})

function ResearchPage() {
  const { t } = useTranslation()
  const { tasks, activeTaskId, createTask, addRound, setFinalReport, setStatus, getActiveTask, setActiveTaskId, deleteTask } =
    useResearchStore()

  const [topic, setTopic] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false)
  const [depth, setDepth] = useState(3)
  const abortRef = useRef(false)
  const [modelSelection, setModelSelection] = useState<TaskModelSelectorValue>({ providerId: '', model: '' })

  const activeTask = getActiveTask()

  // 调用 AI（流式）
  const callAI = useCallback(
    async (prompt: string, taskId: string): Promise<string> => {
      const { providerId, model: modelId } = modelSelection
      if (!providerId || !modelId) throw new Error('请选择服务商和模型')

      return new Promise((resolve, reject) => {
        let text = ''
        let isDone = false

        const unsub = api.research.onStream((_event: unknown, data: unknown) => {
          const chunk = data as { taskId: string; textDelta?: string; content?: string; error?: string; done: boolean }
          if (chunk.taskId !== taskId) return
          if (chunk.textDelta) text += chunk.textDelta
          if (chunk.error) { isDone = true; unsub(); reject(new Error(chunk.error)); return }
          if (chunk.done) {
            isDone = true; unsub()
            resolve(chunk.content || text)
          }
        })

        api.research.stream({ providerId, modelId, prompt, taskId }).catch((err: Error) => {
          if (!isDone) { isDone = true; unsub(); reject(err) }
        })

        setTimeout(() => {
          if (!isDone) {
            isDone = true; unsub()
            if (text) resolve(text)
            else reject(new Error('超时'))
          }
        }, 300000)
      })
    },
    [modelSelection]
  )

  // 执行深度研究（带上下文传递）
  const runResearch = useCallback(
    async (taskId: string, researchTopic: string) => {
      abortRef.current = false
      setIsRunning(true)
      setError(null)
      setStatus(taskId, 'researching')

      const contextParts: string[] = []

      try {
        for (let round = 1; round <= depth; round++) {
          if (abortRef.current) return

          const contextSection = contextParts.length > 0
            ? `\n\n## 此前研究发现\n${contextParts.join('\n\n')}\n`
            : ''

          let query: string
          if (round < depth) {
            // 研究轮：生成问题 + 深入分析
            query = `请针对主题「${researchTopic}」进行研究。${contextSection}\n\n这是第 ${round} 轮研究（共 ${depth} 轮）。请提出 ${3 - round + 1} 个关键研究问题，并给出详细回答。用 Markdown 格式。`
          } else {
            // 最终轮：综合报告
            query = `请基于以下所有研究发现，撰写一份结构化深度报告。${contextSection}\n\n主题：「${researchTopic}」\n\n请按以下结构输出：\n## 执行摘要\n## 核心发现\n## 详细分析\n## 结论与建议\n\n使用 Markdown 格式，内容要详尽、有深度。`
          }

          const answer = await callAI(query, `${taskId}-r${round}`)
          if (abortRef.current) return

          addRound(taskId, { round, query, findings: answer, sources: [] })
          contextParts.push(`### 第${round}轮发现\n${answer}`)
        }

        // 最终报告取最后一轮的 findings
        const finalTask = useResearchStore.getState().tasks.find((tt) => tt.id === taskId)
        const lastRound = finalTask?.rounds[finalTask.rounds.length - 1]
        if (lastRound) {
          setFinalReport(taskId, lastRound.findings)
        }
        setStatus(taskId, 'completed')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setStatus(taskId, 'failed')
      } finally {
        setIsRunning(false)
      }
    },
    [addRound, callAI, depth, setFinalReport, setStatus]
  )

  const handleStart = useCallback(() => {
    if (!topic.trim() || isRunning) return
    const id = createTask(topic.trim())
    runResearch(id, topic.trim())
    setTopic('')
    setIsStartDialogOpen(false)
  }, [topic, isRunning, createTask, runResearch])

  const handleNewResearch = useCallback(() => {
    abortRef.current = true
    setIsRunning(false)
    setActiveTaskId('')
    setTopic('')
    setIsStartDialogOpen(true)
  }, [setActiveTaskId])

  const handleCopy = useCallback(() => {
    if (!activeTask?.finalReport) return
    navigator.clipboard.writeText(activeTask.finalReport)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeTask])

  const handleExport = useCallback(() => {
    if (!activeTask?.finalReport) return
    const blob = new Blob([activeTask.finalReport], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `研究报告_${activeTask.topic.slice(0, 30)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeTask])

  const statusLabel = (status: string) => {
    switch (status) {
      case 'researching': return t('research.statusResearching')
      case 'completed': return t('research.statusCompleted')
      case 'failed': return t('research.statusFailed')
      default: return ''
    }
  }

  return (
    <div className='h-[calc(100vh-3rem)] flex' style={{ background: 'var(--juhe-void)' }}>
      {/* Sidebar */}
      <aside className='w-64 shrink-0 border-r border-[var(--juhe-border)] bg-[var(--juhe-surface)] flex flex-col'>
        <div className='p-4 border-b border-[var(--juhe-border)] flex items-center justify-between'>
          <h2 className='font-semibold text-sm'>{t('research.title')}</h2>
          <button type='button' onClick={handleNewResearch} className='p-1.5 rounded-md bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90' title={t('research.newResearch')}>
            <PlusIcon className='w-4 h-4' />
          </button>
        </div>
        <div className='flex-1overflow-y-auto p-2 space-y-1'>
          {tasks.length === 0 && <div className='text-xs text-[var(--juhe-text-3)] text-center py-8'>{t('research.noTasks')}</div>}
          {tasks.map((task) => (
            <div key={task.id} className={`group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${activeTaskId === task.id ? 'bg-white/[0.03]' : 'hover:bg-[var(--juhe-surface-2)]'}`}>
              <button type='button' className='flex-1 text-left min-w-0' onClick={() => setActiveTaskId(task.id)}>
                <div className='font-medium text-xs truncate'>{task.topic}</div>
                <div className='flex items-center gap-2 mt-0.5 text-[10px] text-[var(--juhe-text-3)]'>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${task.status === 'completed' ? 'bg-[var(--juhe-emerald)]' : task.status === 'failed' ? 'bg-[var(--juhe-magenta)]' : 'bg-[var(--juhe-cyan)] animate-pulse'}`} />
                  {statusLabel(task.status)}
                  {task.rounds.length > 0 && <span className='text-[9px]'>· {task.rounds.length}轮</span>}
                </div>
              </button>
              <button type='button' onClick={() => { deleteTask(task.id); if (activeTaskId === task.id) setActiveTaskId('') }} className='p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--juhe-text-3)] hover:text-red-400 transition-all shrink-0' title='删除'>
                <TrashIcon className='w-3 h-3' />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className='flex-1 flex flex-col min-w-0 bg-[var(--juhe-void-2)]'>
        <header className='h-14 border-b border-[var(--juhe-border)] flex items-center justify-between px-4 shrink-0'>
          <div className='flex items-center gap-2'>
            <BookOpenIcon className='w-5 h-5 text-[var(--juhe-cyan)]' />
            <h1 className='font-semibold'>{t('research.title')}</h1>
          </div>
          <div className='flex items-center gap-2'>
            {activeTask?.finalReport && (
              <>
                <button type='button' onClick={handleExport} className='flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--juhe-border)] text-xs hover:bg-[var(--juhe-surface-2)] transition-colors' title='导出 Markdown'>
                  <DownloadIcon className='w-3.5 h-3.5' /> 导出
                </button>
                <button type='button' onClick={handleCopy} className='flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--juhe-border)] text-xs hover:bg-[var(--juhe-surface-2)] transition-colors'>
                  {copied ? <CheckIcon className='w-3.5 h-3.5 text-[var(--juhe-emerald)]' /> : <CopyIcon className='w-3.5 h-3.5' />}
                  {copied ? '已复制' : '复制'}
                </button>
              </>
            )}
          </div>
        </header>

        <div className='flex-1 overflow-y-auto p-4'>
          {!activeTask && (
            <div className='max-w-xl mx-auto mt-12 space-y-6'>
              <div className='text-center'>
                <SearchIcon className='w-10 h-10 text-[var(--juhe-cyan)] mx-auto mb-4' />
                <h2 className='text-xl font-semibold mb-2'>{t('research.title')}</h2>
                <p className='text-sm text-[var(--juhe-text-3)]'>{t('research.researchHint')}</p>
              </div>
              <ResearchConfig modelSelection={modelSelection} onModelChange={setModelSelection} depth={depth} onDepthChange={setDepth} error={error} />
              <div className='flex gap-2'>
                <input type='text' value={topic} onChange={(e) => { setTopic(e.target.value); setError(null) }} onKeyDown={(e) => e.key === 'Enter' && handleStart()} placeholder={t('research.topicPlaceholder')} className='flex-1 px-3 py-2 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/50' />
                <button type='button' onClick={handleStart} disabled={!topic.trim() || isRunning || !modelSelection.providerId} className='px-4 py-2 rounded-md bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50'>
                  {isRunning ? <span className='flex items-center gap-1.5'><Spinner className='w-4 h-4' />{t('research.researching')}</span> : t('research.startResearch')}
                </button>
              </div>
            </div>
          )}

          {activeTask && (
            <div className='max-w-3xl mx-auto space-y-6'>
              {activeTask.status === 'idle' && (
                <div className='space-y-4'>
                  <ResearchConfig modelSelection={modelSelection} onModelChange={setModelSelection} depth={depth} onDepthChange={setDepth} error={error} />
                  <div className='flex gap-2'>
                    <input type='text' value={topic} onChange={(e) => { setTopic(e.target.value); setError(null) }} onKeyDown={(e) => e.key === 'Enter' && handleStart()} placeholder={t('research.topicPlaceholder')} className='flex-1 px-3 py-2 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/50' />
                    <button type='button' onClick={handleStart} disabled={!topic.trim() || isRunning || !modelSelection.providerId} className='px-4 py-2 rounded-md bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50'>
                      {t('research.startResearch')}
                    </button>
                  </div>
                </div>
              )}

              {activeTask.rounds.length > 0 && (
                <div className='space-y-4'>
                  <h3 className='text-sm font-semibold flex items-center gap-2'>
                    <SparklesIcon className='w-4 h-4 text-[var(--juhe-cyan)]' />
                    {t('research.rounds')} ({activeTask.rounds.length}/{depth})
                  </h3>
                  {activeTask.rounds.map((round) => (
                    <RoundCard key={round.round} round={round} t={t} />
                  ))}
                  {isRunning && activeTask.rounds.length < depth && (
                    <div className='flex items-center gap-2 text-sm text-[var(--juhe-text-3)] px-4 py-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-surface)]'>
                      <Spinner className='w-4 h-4' />
                      正在执行第 {activeTask.rounds.length + 1} 轮研究…
                    </div>
                  )}
                </div>
              )}

              {activeTask.finalReport && (
                <div className='space-y-3'>
                  <h3 className='text-sm font-semibold flex items-center gap-2'>
                    <FileTextIcon className='w-4 h-4 text-[var(--juhe-cyan)]' />
                    {t('research.finalReport')}
                  </h3>
                  <div className='rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-surface)] p-4'>
                    <MarkdownRenderer content={activeTask.finalReport} />
                  </div>
                </div>
              )}

              {activeTask.rounds.length === 0 && activeTask.status === 'idle' && (
                <div className='text-center text-sm text-[var(--juhe-text-3)] py-12'>{t('research.researchHint')}</div>
              )}
            </div>
          )}
        </div>
      </main>

      <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
        <DialogContent size='lg' className='bg-[var(--juhe-void-2)] border-[var(--juhe-border)]'>
          <DialogHeader>
            <DialogTitle className='text-[var(--juhe-text)]'>{t('research.newResearch')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <ResearchConfig modelSelection={modelSelection} onModelChange={setModelSelection} depth={depth} onDepthChange={setDepth} error={error} />
            <input type='text' value={topic} onChange={(e) => { setTopic(e.target.value); setError(null) }} onKeyDown={(e) => e.key === 'Enter' && handleStart()} placeholder={t('research.topicPlaceholder')} className='w-full px-3 py-2 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/50' />
          </div>
          <DialogFooter>
            <button type='button' onClick={() => setIsStartDialogOpen(false)} className='px-3 py-1.5 rounded-lg text-sm text-[var(--juhe-text-3)] hover:bg-white/[0.03]'>{t('common.cancel')}</button>
            <button type='button' onClick={handleStart} disabled={!topic.trim() || isRunning || !modelSelection.providerId} className='px-4 py-1.5 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50'>
              {isRunning ? t('research.researching') : t('research.startResearch')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Config Panel =====

function ResearchConfig({ modelSelection, onModelChange, depth, onDepthChange, error }: {
  modelSelection: TaskModelSelectorValue
  onModelChange: (v: TaskModelSelectorValue) => void
  depth: number
  onDepthChange: (n: number) => void
  error: string | null
}) {
  return (
    <div className='space-y-3 p-4 rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface)]/30'>
      <div className='flex items-center gap-3'>
        <label className='text-xs text-[var(--juhe-text-3)] shrink-0'>研究深度</label>
        <div className='flex gap-1.5'>
          {[3, 5, 7].map((d) => (
            <button key={d} type='button' onClick={() => onDepthChange(d)} className={`px-3 h-7 rounded-lg text-xs font-medium transition-all ${depth === d ? 'bg-[var(--juhe-cyan)] text-white' : 'bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-3)] hover:border-[var(--juhe-cyan)]/30'}`}>
              {d}轮
            </button>
          ))}
        </div>
      </div>
      <TaskModelSelector capabilities={['chat', 'reasoning']} providerId={modelSelection.providerId} model={modelSelection.model} onChange={onModelChange} />
      {error && (
        <div className='p-2.5 rounded-lg bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)] text-xs flex items-center gap-2'>
          <AlertCircleIcon className='w-3.5 h-3.5 shrink-0' /> {error}
        </div>
      )}
    </div>
  )
}

// ===== Round Card =====

function RoundCard({ round, t }: { round: ResearchRound; t: (key: string, options?: Record<string, unknown>) => string }) {
  return (
    <div className='rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-surface)] p-4 space-y-3'>
      <div className='flex items-center gap-2 text-xs font-medium text-[var(--juhe-text-3)] uppercase tracking-wide'>
        <span className='w-5 h-5 rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)] flex items-center justify-center text-[10px] font-bold'>{round.round}</span>
        {t('research.roundN', { n: round.round })}
      </div>
      <div className='text-sm leading-relaxed'>
        <MarkdownRenderer content={round.findings} />
      </div>
    </div>
  )
}
