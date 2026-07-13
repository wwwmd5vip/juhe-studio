import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@cherrystudio/ui'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  GitBranch,
  GitMerge,
  Layers,
  Loader2,
  MessageCircle,
  Play,
  Plus,
  Save,
  Trash2,
  TreePine,
  Users,
  Wrench,
  X
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'
import { TaskModelSelector } from '@/components/common/TaskModelSelector'
import { type AgentSquad, PRESET_SQUADS, type SquadMode, useAgentSquadStore } from '@/stores/agent-squad'
import { getAllAgents, useAgentsStore } from '@/stores/agents'

export const Route = createFileRoute('/agent-squad')({
  component: AgentSquadPage
})

const MODE_CONFIG: {
  mode: SquadMode
  icon: React.ReactNode
  labelKey: string
  descKey: string
}[] = [
  {
    mode: 'sequential',
    icon: <GitBranch className='w-5 h-5' />,
    labelKey: 'agentSquad.sequential',
    descKey: 'agentSquad.sequentialDesc'
  },
  {
    mode: 'parallel',
    icon: <GitMerge className='w-5 h-5' />,
    labelKey: 'agentSquad.parallel',
    descKey: 'agentSquad.parallelDesc'
  },
  {
    mode: 'debate',
    icon: <MessageCircle className='w-5 h-5' />,
    labelKey: 'agentSquad.debate',
    descKey: 'agentSquad.debateDesc'
  },
  {
    mode: 'hierarchical',
    icon: <Layers className='w-5 h-5' />,
    labelKey: 'agentSquad.hierarchical',
    descKey: 'agentSquad.hierarchicalDesc'
  }
]

function AgentSquadPage() {
  const { t } = useTranslation()
  const {
    squads,
    activeSquadId,
    isRunning,
    currentStep,
    totalSteps,
    results,
    finalOutput,
    error,
    enableMcpTools,
    createSquad,
    updateSquad,
    deleteSquad,
    setActiveSquad,
    runSquad,
    cancelRun,
    resetResults,
    setEnableMcpTools
  } = useAgentSquadStore()
  const { agents } = useAgentsStore()

  const allAgents = useMemo(() => getAllAgents(agents), [agents])

  const activeSquad = squads.find((s) => s.id === activeSquadId) || null

  const [isEditing, setIsEditing] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    description: string
    mode: SquadMode
    agents: {
      agentId: string
      order?: number
      role?: string
      providerId?: string
      modelId?: string
      temperature?: number
    }[]
    sharedContext: boolean
  }>({
    name: '',
    description: '',
    mode: 'sequential',
    agents: [],
    sharedContext: true
  })

  const [taskInput, setTaskInput] = useState('')

  const createFromPreset = (preset: (typeof PRESET_SQUADS)[number]) => {
    createSquad({ ...preset })
    setIsEditing(false)
    resetResults()
  }

  const startNewSquad = () => {
    setEditForm({
      name: '',
      description: '',
      mode: 'sequential',
      agents: [],
      sharedContext: true
    })
    setActiveSquad(null)
    setIsEditing(true)
    resetResults()
  }

  const startEditSquad = (squad: AgentSquad) => {
    setEditForm({
      name: squad.name,
      description: squad.description,
      mode: squad.mode,
      agents: [...squad.agents],
      sharedContext: squad.sharedContext
    })
    setActiveSquad(squad.id)
    setIsEditing(true)
    resetResults()
  }

  const handleSave = () => {
    if (!editForm.name.trim()) return
    if (activeSquad) {
      updateSquad(activeSquad.id, { ...editForm })
    } else {
      createSquad({ ...editForm })
    }
    setIsEditing(false)
  }

  const handleDelete = (id: string) => {
    setDeleteTargetId(id)
  }

  const handleRun = async () => {
    if (!activeSquad || !taskInput.trim() || isRunning) return
    resetResults()
    await runSquad(activeSquad.id, taskInput.trim())
  }

  const getAgentName = (agentId: string) => {
    const a = allAgents.find((ag) => ag.id === agentId)
    return a ? (a.name.startsWith('agents.') ? t(a.name) : a.name) : agentId
  }

  return (
    <div className='h-full flex' style={{ background: 'var(--juhe-void)' }}>
      {/* Left sidebar */}
      <div className='w-64 shrink-0 border-r border-[var(--juhe-border)] flex flex-col bg-[var(--juhe-surface)]/30'>
        <div className='flex items-center justify-between p-3 border-b border-[var(--juhe-border)]'>
          <div className='flex items-center gap-2'>
            <Users className='w-5 h-5 text-[var(--juhe-cyan)]' />
            <h2 className='text-sm font-semibold'>{t('agentSquad.title')}</h2>
          </div>
          <button
            type='button'
            onClick={startNewSquad}
            className='p-1.5 rounded-md hover:bg-white/[0.03] transition-colors'
            title={t('agentSquad.newSquad')}
          >
            <Plus className='w-4 h-4' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-2 space-y-1'>
          <div className='px-2 py-1 text-[10px] font-medium text-[var(--juhe-text-3)] uppercase tracking-wider'>
            {t('agentSquad.templates')}
          </div>
          <div className='space-y-1 mb-3'>
            {PRESET_SQUADS.map((preset) => (
              <button
                type='button'
                key={preset.name}
                onClick={() => createFromPreset(preset)}
                className='w-full text-left px-2.5 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void)]/40 hover:bg-white/[0.03] transition-colors'
              >
                <div className='text-xs font-medium truncate'>{t(preset.name)}</div>
                <div className='text-[10px] text-[var(--juhe-text-3)] truncate'>
                  {t(`agentSquad.${preset.mode}`)} · {preset.agents.length} agents
                </div>
              </button>
            ))}
          </div>
          <div className='px-2 py-1 text-[10px] font-medium text-[var(--juhe-text-3)] uppercase tracking-wider'>
            {t('agentSquad.mySquads')}
          </div>
          {squads.length === 0 ? (
            <div className='px-2 py-4 text-xs text-[var(--juhe-text-3)] text-center'>{t('common.empty')}</div>
          ) : (
            squads.map((squad) => (
              <button
                type='button'
                key={squad.id}
                onClick={() => {
                  setActiveSquad(squad.id)
                  setIsEditing(false)
                  resetResults()
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors group ${
                  activeSquadId === squad.id && !isEditing
                    ? 'bg-white/[0.03] text-white'
                    : 'hover:bg-white/[0.03]/50 text-[var(--juhe-text)]'
                }`}
              >
                <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)] flex items-center justify-center shrink-0'>
                  <Users className='w-4 h-4' />
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='font-medium text-sm truncate'>
                    {squad.name.startsWith('agentSquad.') ? t(squad.name) : squad.name}
                  </div>
                  <div className='text-[10px] text-[var(--juhe-text-3)] truncate'>
                    {t(`agentSquad.${squad.mode}`)} · {squad.agents.length} agents
                  </div>
                </div>
                <button
                  type='button'
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(squad.id)
                  }}
                  className='p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--juhe-magenta)]/10 hover:text-[var(--juhe-magenta)] transition-opacity shrink-0'
                >
                  <Trash2 className='w-3 h-3' />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main area */}
      <div className='flex-1 flex flex-col min-w-0 bg-[var(--juhe-void-2)] overflow-hidden'>
        {activeSquad ? (
          <SquadRunner
            squad={activeSquad}
            taskInput={taskInput}
            setTaskInput={setTaskInput}
            onRun={handleRun}
            onCancel={cancelRun}
            isRunning={isRunning}
            currentStep={currentStep}
            totalSteps={totalSteps}
            results={results}
            finalOutput={finalOutput}
            error={error}
            enableMcpTools={enableMcpTools}
            onToggleMcpTools={setEnableMcpTools}
            getAgentName={getAgentName}
            onEdit={() => startEditSquad(activeSquad)}
            t={t}
          />
        ) : (
          <div className='flex-1 flex flex-col items-center justify-center text-[var(--juhe-text-3)]'>
            <Users className='w-12 h-12 mb-3 opacity-20' />
            <p className='text-sm'>{t('common.empty')}</p>
            <button
              type='button'
              onClick={startNewSquad}
              className='mt-4 px-4 py-2 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-sm hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
            >
              {t('agentSquad.newSquad')}
            </button>
          </div>
        )}
      </div>

      <SquadEditorDialog
        open={isEditing}
        form={editForm}
        setForm={setEditForm}
        onSave={handleSave}
        onOpenChange={(open) => {
          setIsEditing(open)
          if (!open && !activeSquad) setActiveSquad(null)
        }}
        isNew={!activeSquad}
        allAgents={allAgents}
        t={t}
      />

      <ConfirmModal
        open={deleteTargetId !== null}
        title={t('common.confirm') as string}
        description={t('common.confirm') as string}
        confirmText={t('common.delete') as string}
        cancelText={t('common.cancel') as string}
        danger
        onConfirm={() => {
          if (deleteTargetId) {
            deleteSquad(deleteTargetId)
            if (activeSquadId === deleteTargetId) {
              setIsEditing(false)
            }
          }
          setDeleteTargetId(null)
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  )
}

function SquadEditorDialog({
  open,
  form,
  setForm,
  onSave,
  onOpenChange,
  isNew,
  allAgents,
  t
}: {
  open: boolean
  form: {
    name: string
    description: string
    mode: SquadMode
    agents: {
      agentId: string
      order?: number
      role?: string
      providerId?: string
      modelId?: string
      temperature?: number
    }[]
    sharedContext: boolean
  }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
  onSave: () => void
  onOpenChange: (open: boolean) => void
  isNew: boolean
  allAgents: ReturnType<typeof getAllAgents>
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const selectedAgentIds = form.agents.map((a) => a.agentId)

  const toggleAgent = (agentId: string) => {
    if (selectedAgentIds.includes(agentId)) {
      setForm((f) => ({
        ...f,
        agents: f.agents.filter((a) => a.agentId !== agentId)
      }))
      return
    }

    setForm((f) => ({
      ...f,
      agents: [
        ...f.agents,
        {
          agentId,
          order: f.agents.length + 1,
          role: '',
          providerId: undefined,
          modelId: undefined,
          temperature: undefined
        }
      ]
    }))
  }

  const updateAgentField = (
    agentId: string,
    field: 'order' | 'role' | 'providerId' | 'modelId' | 'temperature',
    value: string | number | undefined
  ) => {
    setForm((f) => ({
      ...f,
      agents: f.agents.map((a) => (a.agentId === agentId ? { ...a, [field]: value } : a))
    }))
  }

  const getAgentDisplayName = (agent: (typeof allAgents)[0]) =>
    agent.name.startsWith('agents.') ? t(agent.name) : agent.name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size='lg'
        className='max-h-[90vh] overflow-hidden bg-[var(--juhe-void-2)] border-[var(--juhe-border)]'
      >
        <DialogHeader className='text-left'>
          <DialogTitle className='text-[var(--juhe-text)]'>
            {isNew ? t('agentSquad.newSquad') : t('common.edit')}
          </DialogTitle>
          <DialogDescription className='text-[var(--juhe-text-3)]'>{t('agentSquad.selectAgents')}</DialogDescription>
        </DialogHeader>

        <div className='max-h-[calc(90vh-11rem)] overflow-y-auto pr-1 space-y-6'>
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>{t('agents.name')}</label>
            <input
              type='text'
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('agents.agentNamePlaceholder')}
              className='w-full px-3 py-2 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-sm placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 focus:border-[var(--juhe-cyan)]/50 transition-colors'
            />
          </div>

          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>{t('agents.description')}</label>
            <input
              type='text'
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('agents.agentDescPlaceholder')}
              className='w-full px-3 py-2 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-sm placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 focus:border-[var(--juhe-cyan)]/50 transition-colors'
            />
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>{t('agentSquad.mode')}</label>
            <div className='grid grid-cols-2 gap-3'>
              {MODE_CONFIG.map((cfg) => (
                <button
                  type='button'
                  key={cfg.mode}
                  onClick={() => setForm((f) => ({ ...f, mode: cfg.mode }))}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                    form.mode === cfg.mode
                      ? 'border-[var(--juhe-cyan)] bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/5'
                      : 'border-[var(--juhe-border)] hover:bg-white/[0.03]/50'
                  }`}
                >
                  <div
                    className={`mt-0.5 ${form.mode === cfg.mode ? 'text-[var(--juhe-cyan)]' : 'text-[var(--juhe-text-3)]'}`}
                  >
                    {cfg.icon}
                  </div>
                  <div>
                    <div
                      className={`text-sm font-medium ${form.mode === cfg.mode ? 'text-[var(--juhe-cyan)]' : 'text-[var(--juhe-text)]'}`}
                    >
                      {t(cfg.labelKey)}
                    </div>
                    <div className='text-xs text-[var(--juhe-text-3)] mt-0.5 leading-relaxed'>{t(cfg.descKey)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>{t('agentSquad.selectAgents')}</label>
            <div className='space-y-2 max-h-48 overflow-y-auto border border-[var(--juhe-border)] rounded-lg p-2'>
              {allAgents.length === 0 ? (
                <div className='text-xs text-[var(--juhe-text-3)] text-center py-2'>{t('agents.noAgents')}</div>
              ) : (
                allAgents.map((agent) => {
                  const selected = selectedAgentIds.includes(agent.id)
                  return (
                    <label
                      key={agent.id}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                        selected
                          ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/5'
                          : 'hover:bg-white/[0.03]/30'
                      }`}
                    >
                      <input
                        type='checkbox'
                        checked={selected}
                        onChange={() => toggleAgent(agent.id)}
                        className='rounded border-[var(--juhe-border)] text-[var(--juhe-cyan)] focus:ring-[var(--juhe-cyan)]/30'
                      />
                      <span className='text-sm'>{getAgentDisplayName(agent)}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {form.agents.length > 0 && (
            <div className='space-y-2'>
              <label className='text-sm font-medium'>{t('agentSquad.role')}</label>
              <div className='space-y-3'>
                {form.agents.map((a, idx) => {
                  const agent = allAgents.find((ag) => ag.id === a.agentId)
                  if (!agent) return null

                  return (
                    <div
                      key={a.agentId}
                      className='flex flex-col gap-2 p-2.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-surface)]/50'
                    >
                      <div className='flex items-center gap-3'>
                        <span className='text-sm font-medium min-w-[120px]'>{getAgentDisplayName(agent)}</span>
                        {form.mode === 'sequential' && (
                          <div className='flex items-center gap-2'>
                            <span className='text-xs text-[var(--juhe-text-3)]'>
                              {t('agentSquad.stepN', { n: '' })}
                            </span>
                            <input
                              type='number'
                              min={1}
                              value={a.order ?? idx + 1}
                              onChange={(e) => updateAgentField(a.agentId, 'order', parseInt(e.target.value, 10) || 1)}
                              className='w-16 px-2 py-1 rounded-md bg-[var(--juhe-void-2)] border border-[var(--juhe-border)] text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30'
                            />
                          </div>
                        )}
                        <input
                          type='text'
                          value={a.role || ''}
                          onChange={(e) => updateAgentField(a.agentId, 'role', e.target.value)}
                          placeholder={t('agentSquad.role')}
                          className='flex-1 px-2 py-1 rounded-md bg-[var(--juhe-void-2)] border border-[var(--juhe-border)] text-sm placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30'
                        />
                        <button
                          type='button'
                          onClick={() => toggleAgent(a.agentId)}
                          className='p-1 rounded hover:bg-[var(--juhe-magenta)]/10 text-[var(--juhe-text-3)] hover:text-[var(--juhe-magenta)] transition-colors'
                        >
                          <X className='w-3.5 h-3.5' />
                        </button>
                      </div>
                      <div className='flex items-center gap-3 pl-[120px]'>
                        <span className='text-xs text-[var(--juhe-text-3)] whitespace-nowrap'>
                          {t('agentSquad.modelOverride')}
                        </span>
                        <div className='flex-1 min-w-0'>
                          <TaskModelSelector
                            providerId={a.providerId || agent.providerId || ''}
                            model={a.modelId || agent.modelId || ''}
                            capabilities={['chat', 'reasoning']}
                            onChange={(value) => {
                              updateAgentField(a.agentId, 'providerId', value.providerId)
                              updateAgentField(a.agentId, 'modelId', value.model)
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <label className='flex items-center gap-2.5 cursor-pointer'>
            <input
              type='checkbox'
              checked={form.sharedContext}
              onChange={(e) => setForm((f) => ({ ...f, sharedContext: e.target.checked }))}
              className='rounded border-[var(--juhe-border)] text-[var(--juhe-cyan)] focus:ring-[var(--juhe-cyan)]/30'
            />
            <span className='text-sm'>{t('agentSquad.sharedContext')}</span>
          </label>
        </div>

        <DialogFooter className='pt-2 border-t border-[var(--juhe-border)]'>
          <button
            type='button'
            onClick={() => onOpenChange(false)}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--juhe-text-3)] hover:bg-white/[0.03] transition-colors'
          >
            <X className='w-4 h-4' />
            {t('common.cancel')}
          </button>
          <button
            type='button'
            onClick={onSave}
            disabled={!form.name.trim() || form.agents.length === 0}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 disabled:opacity-50 transition-colors'
          >
            <Save className='w-4 h-4' />
            {t('common.save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SquadRunner({
  squad,
  taskInput,
  setTaskInput,
  onRun,
  onCancel,
  isRunning,
  currentStep,
  totalSteps,
  results,
  finalOutput,
  error,
  enableMcpTools,
  onToggleMcpTools,
  getAgentName,
  onEdit,
  t
}: {
  squad: AgentSquad
  taskInput: string
  setTaskInput: (v: string) => void
  onRun: () => void
  onCancel: () => void
  isRunning: boolean
  currentStep: number
  totalSteps: number
  results: ReturnType<typeof useAgentSquadStore.getState>['results']
  finalOutput: string
  error: string | null
  enableMcpTools: boolean
  onToggleMcpTools: (enabled: boolean) => void
  getAgentName: (id: string) => string
  onEdit: () => void
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const sortedAgents = useMemo(() => {
    if (squad.mode === 'sequential') {
      return [...squad.agents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
    return squad.agents
  }, [squad])

  const hasFinalOutput = !isRunning && finalOutput.length > 0
  const progressLabel = totalSteps > 0 ? `${Math.min(currentStep + 1, totalSteps)} / ${totalSteps}` : ''

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='flex items-center justify-between px-6 py-4 border-b border-[var(--juhe-border)]'>
        <div className='flex items-center gap-3'>
          <div className='w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)] flex items-center justify-center'>
            <Users className='w-5 h-5' />
          </div>
          <div>
            <h1 className='text-lg font-semibold'>{squad.name}</h1>
            <p className='text-xs text-[var(--juhe-text-3)]'>
              {t(`agentSquad.${squad.mode}`)} · {squad.agents.length} agents
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={onEdit}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
        >
          <ChevronRight className='w-4 h-4' />
          {t('common.edit')}
        </button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-6 py-6 space-y-6'>
        {/* Input */}
        <div className='space-y-2'>
          <label className='text-sm font-medium'>{t('agentSquad.inputTask')}</label>
          <div className='flex gap-2'>
            <textarea
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder={t('agentSquad.inputTask')}
              rows={3}
              disabled={isRunning}
              className='flex-1 px-3 py-2 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-sm placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 focus:border-[var(--juhe-cyan)]/50 transition-colors resize-none disabled:opacity-60'
            />
            {isRunning ? (
              <button
                type='button'
                onClick={onCancel}
                className='self-stretch px-4 rounded-lg bg-[var(--juhe-magenta)]/20 text-[var(--juhe-magenta)] border border-[var(--juhe-magenta)]/30 text-sm font-medium hover:bg-[var(--juhe-magenta)]/30 transition-colors inline-flex flex-col items-center justify-center gap-1'
              >
                <X className='w-4 h-4' />
                <span className='text-[10px]'>{t('common.cancel')}</span>
              </button>
            ) : (
              <button
                type='button'
                onClick={onRun}
                disabled={!taskInput.trim()}
                className='self-stretch px-4 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-sm font-medium hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 disabled:opacity-50 transition-colors inline-flex flex-col items-center justify-center gap-1'
              >
                <Play className='w-4 h-4' />
                <span className='text-[10px]'>{t('agentSquad.runSquad')}</span>
              </button>
            )}
          </div>
          <label className='flex items-center gap-2 text-sm text-[var(--juhe-text-3)]'>
            <input
              type='checkbox'
              checked={enableMcpTools}
              onChange={(e) => onToggleMcpTools(e.target.checked)}
              disabled={isRunning}
              className='rounded border-[var(--juhe-border)] text-[var(--juhe-cyan)]'
            />
            {t('agentSquad.enableMcpTools')}
          </label>
        </div>

        {/* Error notice */}
        {error && (
          <div className='p-3 rounded-lg border border-[var(--juhe-magenta)]/20 bg-[var(--juhe-magenta)]/5 text-sm text-[var(--juhe-magenta)]'>
            {error}
          </div>
        )}

        {/* Execution visualization */}
        {isRunning && (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium flex items-center gap-2'>
              <Loader2 className='w-4 h-4 animate-spin text-[var(--juhe-cyan)]' />
              {t('agentSquad.running')}
              <span className='ml-auto text-[10px] text-[var(--juhe-text-3)]'>{progressLabel}</span>
            </h3>
            {squad.mode === 'sequential' && (
              <SequentialVisual agents={sortedAgents} currentStep={currentStep} getAgentName={getAgentName} t={t} />
            )}
            {squad.mode === 'parallel' && (
              <ParallelVisual agents={sortedAgents} results={results} getAgentName={getAgentName} t={t} />
            )}
            {squad.mode === 'debate' && (
              <DebateVisual
                agents={sortedAgents}
                currentStep={currentStep}
                results={results}
                getAgentName={getAgentName}
                t={t}
              />
            )}
            {squad.mode === 'hierarchical' && (
              <HierarchicalVisual
                agents={sortedAgents}
                currentStep={currentStep}
                results={results}
                getAgentName={getAgentName}
                t={t}
              />
            )}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className='space-y-3'>
            <h3 className='text-sm font-medium'>{t('agentSquad.results')}</h3>
            <div className='space-y-2'>
              {results.map((r, idx) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                  key={idx}
                  className={`p-3 rounded-lg border bg-[var(--juhe-surface)]/50 ${
                    r.status === 'error' ? 'border-[var(--juhe-magenta)]/30' : 'border-[var(--juhe-border)]'
                  }`}
                >
                  <div className='flex items-center gap-2 mb-1.5'>
                    <div className='w-6 h-6 rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)] flex items-center justify-center text-[10px] font-bold'>
                      {getAgentName(r.agentId).charAt(0)}
                    </div>
                    <span className='text-xs font-medium'>{getAgentName(r.agentId)}</span>
                    {r.status === 'streaming' && <Loader2 className='w-3 h-3 animate-spin text-[var(--juhe-cyan)]' />}
                    {r.status === 'error' && (
                      <span className='text-[10px] text-[var(--juhe-magenta)]'>{t('common.error')}</span>
                    )}
                    <span className='text-[10px] text-[var(--juhe-text-3)] ml-auto'>
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p
                    className={`text-sm whitespace-pre-wrap ${
                      r.status === 'error' ? 'text-[var(--juhe-magenta)]' : 'text-[var(--juhe-text)]/80'
                    }`}
                  >
                    {r.output || (r.status === 'streaming' ? t('agentSquad.thinking') : '')}
                  </p>

                  {r.toolEvents && r.toolEvents.length > 0 && (
                    <div className='mt-2 space-y-1.5 border-t border-[var(--juhe-border)] pt-2'>
                      {r.toolEvents.map((ev, evIdx) => (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
                          key={evIdx}
                          className='rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-bg)]/60 p-2'
                        >
                          <div className='flex items-center gap-2 text-xs text-[var(--juhe-cyan)]'>
                            <Wrench className='w-3 h-3' />
                            <span className='font-medium'>{ev.serverId}</span>
                            <span className='text-[var(--juhe-text-3)]'>/</span>
                            <span>{ev.toolName}</span>
                            <span
                              className={`ml-auto text-[10px] ${
                                ev.status === 'success'
                                  ? 'text-[var(--juhe-emerald)]'
                                  : ev.status === 'error'
                                    ? 'text-[var(--juhe-magenta)]'
                                    : 'text-[var(--juhe-cyan)]'
                              }`}
                            >
                              {ev.status === 'success'
                                ? t('agentSquad.toolSuccess')
                                : ev.status === 'error'
                                  ? t('agentSquad.toolError')
                                  : t('agentSquad.toolCalling')}
                            </span>
                          </div>
                          {!!ev.args && Object.keys(ev.args as Record<string, unknown>).length > 0 && (
                            <pre className='mt-1 text-[10px] text-[var(--juhe-text-3)] whitespace-pre-wrap font-mono'>
                              {JSON.stringify(ev.args, null, 2)}
                            </pre>
                          )}
                          {ev.result !== undefined && (
                            <pre className='mt-1 text-[10px] text-[var(--juhe-text)]/70 whitespace-pre-wrap font-mono'>
                              {typeof ev.result === 'string' ? ev.result : JSON.stringify(ev.result, null, 2)}
                            </pre>
                          )}
                          {ev.error && <p className='mt-1 text-[10px] text-[var(--juhe-magenta)]'>{ev.error}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Final synthesis */}
        {hasFinalOutput && (
          <div className='space-y-2'>
            <h3 className='text-sm font-medium flex items-center gap-2'>
              <CheckCircle2 className='w-4 h-4 text-[var(--juhe-emerald)]' />
              {t('agentSquad.finalSynthesis')}
            </h3>
            <div className='p-4 rounded-lg border border-[var(--juhe-emerald)]/20 bg-[var(--juhe-emerald)]/5'>
              <pre className='text-sm text-[var(--juhe-text)]/80 whitespace-pre-wrap font-sans leading-relaxed'>
                {finalOutput}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SequentialVisual({
  agents,
  currentStep,
  getAgentName
}: {
  agents: AgentSquad['agents']
  currentStep: number
  getAgentName: (id: string) => string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <div className='flex items-center gap-2 flex-wrap'>
      {agents.map((a, idx) => {
        const isActive = idx === currentStep
        const isDone = idx < currentStep
        return (
          <div key={a.agentId} className='flex items-center gap-2'>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                isActive
                  ? 'border-[var(--juhe-cyan)] bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)]'
                  : isDone
                    ? 'border-[var(--juhe-emerald)]/30 bg-[var(--juhe-emerald)]/10 text-[var(--juhe-emerald)]'
                    : 'border-[var(--juhe-border)] bg-[var(--juhe-surface)] text-[var(--juhe-text-3)]'
              }`}
            >
              {isActive ? (
                <Loader2 className='w-3.5 h-3.5 animate-spin' />
              ) : isDone ? (
                <CheckCircle2 className='w-3.5 h-3.5' />
              ) : (
                <Circle className='w-3.5 h-3.5' />
              )}
              <span className='font-medium'>{getAgentName(a.agentId)}</span>
              {a.role && <span className='text-[10px] opacity-70'>({a.role})</span>}
            </div>
            {idx < agents.length - 1 && <ArrowRight className='w-4 h-4 text-[var(--juhe-text-3)]' />}
          </div>
        )
      })}
    </div>
  )
}

function ParallelVisual({
  agents,
  results,
  getAgentName
}: {
  agents: AgentSquad['agents']
  results: ReturnType<typeof useAgentSquadStore.getState>['results']
  getAgentName: (id: string) => string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <div className='grid grid-cols-2 gap-3'>
      {agents.map((a) => {
        const hasResult = results.some((r) => r.agentId === a.agentId)
        return (
          <div
            key={a.agentId}
            className={`p-3 rounded-lg border text-sm transition-colors ${
              hasResult
                ? 'border-[var(--juhe-emerald)]/30 bg-[var(--juhe-emerald)]/10'
                : 'border-[var(--juhe-cyan)]/30 bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/5'
            }`}
          >
            <div className='flex items-center gap-2'>
              {hasResult ? (
                <CheckCircle2 className='w-4 h-4 text-[var(--juhe-emerald)]' />
              ) : (
                <Loader2 className='w-4 h-4 animate-spin text-[var(--juhe-cyan)]' />
              )}
              <span className='font-medium'>{getAgentName(a.agentId)}</span>
            </div>
            {a.role && <div className='text-[10px] text-[var(--juhe-text-3)] mt-1'>{a.role}</div>}
          </div>
        )
      })}
    </div>
  )
}

function DebateVisual({
  agents,
  currentStep,
  results,
  getAgentName,
  t
}: {
  agents: AgentSquad['agents']
  currentStep: number
  results: ReturnType<typeof useAgentSquadStore.getState>['results']
  getAgentName: (id: string) => string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <div className='space-y-3'>
      {agents.map((a, idx) => {
        const isActive = idx === currentStep
        const result = results.find((r) => r.agentId === a.agentId)
        return (
          <div key={a.agentId} className={`flex gap-3 ${idx % 2 === 1 ? 'flex-row-reverse' : ''}`}>
            <div className='w-8 h-8 rounded-full bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)] flex items-center justify-center shrink-0 text-xs font-bold'>
              {getAgentName(a.agentId).charAt(0)}
            </div>
            <div
              className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm transition-colors ${
                isActive
                  ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white'
                  : result
                    ? 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text)]'
                    : 'bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-[var(--juhe-text-3)]'
              }`}
            >
              <div className='text-xs font-medium mb-0.5 opacity-80'>
                {getAgentName(a.agentId)}
                {a.role && ` · ${a.role}`}
              </div>
              {result ? (
                result.output
              ) : isActive ? (
                <span className='inline-flex items-center gap-1.5'>
                  <Loader2 className='w-3 h-3 animate-spin' />
                  {t('agentSquad.running')}
                </span>
              ) : (
                t('agentSquad.stepN', { n: idx + 1 })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HierarchicalVisual({
  agents,
  currentStep,
  results,
  getAgentName
}: {
  agents: AgentSquad['agents']
  currentStep: number
  results: ReturnType<typeof useAgentSquadStore.getState>['results']
  getAgentName: (id: string) => string
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  if (agents.length === 0) return null
  const manager = agents[0]
  const workers = agents.slice(1)

  return (
    <div className='flex flex-col items-center gap-4'>
      {/* Manager */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm ${
          currentStep === 0 && !results.some((r) => r.agentId === manager.agentId)
            ? 'border-[var(--juhe-cyan)] bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)]'
            : results.some((r) => r.agentId === manager.agentId)
              ? 'border-[var(--juhe-emerald)]/30 bg-[var(--juhe-emerald)]/10 text-[var(--juhe-emerald)]'
              : 'border-[var(--juhe-border)] bg-[var(--juhe-surface)] text-[var(--juhe-text-3)]'
        }`}
      >
        <TreePine className='w-4 h-4' />
        <span className='font-medium'>{getAgentName(manager.agentId)}</span>
        {manager.role && <span className='text-[10px] opacity-70'>({manager.role})</span>}
      </div>

      {/* Connector */}
      <div className='w-px h-4 bg-[var(--juhe-border)]' />
      <div className='flex gap-2'>
        {workers.map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
<div key={i} className='flex items-center gap-2'>
            <div className='h-px w-6 bg-[var(--juhe-border)]' />
            {i < workers.length - 1 && <div className='h-px w-6 bg-[var(--juhe-border)]' />}
          </div>
        ))}
      </div>
      <div className='w-px h-4 bg-[var(--juhe-border)]' />

      {/* Workers */}
      <div className='flex flex-wrap gap-3 justify-center'>
        {workers.map((a, idx) => {
          const stepIdx = idx + 1
          const isActive = currentStep === stepIdx
          const hasResult = results.some((r) => r.agentId === a.agentId)
          return (
            <div
              key={a.agentId}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                isActive
                  ? 'border-[var(--juhe-cyan)] bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)]'
                  : hasResult
                    ? 'border-[var(--juhe-emerald)]/30 bg-[var(--juhe-emerald)]/10 text-[var(--juhe-emerald)]'
                    : 'border-[var(--juhe-border)] bg-[var(--juhe-surface)] text-[var(--juhe-text-3)]'
              }`}
            >
              {isActive ? (
                <Loader2 className='w-3.5 h-3.5 animate-spin' />
              ) : hasResult ? (
                <CheckCircle2 className='w-3.5 h-3.5' />
              ) : (
                <Circle className='w-3.5 h-3.5' />
              )}
              <span className='font-medium'>{getAgentName(a.agentId)}</span>
              {a.role && <span className='text-[10px] opacity-70'>({a.role})</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
