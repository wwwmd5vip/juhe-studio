import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@cherrystudio/ui'
import type { Provider } from '@shared/types/provider'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import {
  BarChart3,
  BookOpen,
  Bot,
  Brush,
  ChevronRight,
  ClipboardList,
  Code2,
  GraduationCap,
  HeartHandshake,
  Languages,
  Megaphone,
  MessageSquare,
  Plus,
  Save,
  Scale,
  Search,
  Sparkles,
  Trash2,
  UserCircle,
  X
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmModal from '@/components/ConfirmModal'
import PromptSelectorDrawer from '@/components/prompts/PromptSelectorDrawer'
import { getAllAgents, isPresetAgent, useAgentsStore } from '@/stores/agents'
import { useChatStore } from '@/stores/chat'
import { useProviderStore } from '@/stores/providers'

export const Route = createFileRoute('/agents')({
  component: AgentsPage
})

const PRESET_ICONS: Record<string, React.ReactNode> = {
  'preset-creative-writing': <Sparkles className='w-5 h-5' />,
  'preset-code-expert': <Code2 className='w-5 h-5' />,
  'preset-translator': <Languages className='w-5 h-5' />,
  'preset-academic-researcher': <GraduationCap className='w-5 h-5' />,
  'preset-life-coach': <HeartHandshake className='w-5 h-5' />,
  'preset-product-manager': <ClipboardList className='w-5 h-5' />,
  'preset-market-strategist': <Megaphone className='w-5 h-5' />,
  'preset-prompt-engineer': <Sparkles className='w-5 h-5' />,
  'preset-visual-designer': <Brush className='w-5 h-5' />,
  'preset-data-analyst': <BarChart3 className='w-5 h-5' />,
  'preset-critical-reviewer': <Search className='w-5 h-5' />,
  'preset-project-planner': <ClipboardList className='w-5 h-5' />,
  'preset-brand-copywriter': <Megaphone className='w-5 h-5' />,
  'preset-legal-risk-advisor': <Scale className='w-5 h-5' />,
  'preset-customer-researcher': <UserCircle className='w-5 h-5' />
}

function AgentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/agents' }) as { systemPrompt?: string }
  const { agents, selectedAgentId, selectAgent, createAgent, updateAgent, deleteAgent } = useAgentsStore()
  const { createSession } = useChatStore()
  const { providers } = useProviderStore()

  const allAgents = useMemo(() => getAllAgents(agents), [agents])

  const presetAgents = allAgents.filter((a) => isPresetAgent(a.id))
  const customAgents = allAgents.filter((a) => !isPresetAgent(a.id))

  const selectedAgent = allAgents.find((a) => a.id === selectedAgentId) || null

  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [promptDrawerOpen, setPromptDrawerOpen] = useState(false)
  const [editForm, setEditForm] = useState<{
    name: string
    description: string
    systemPrompt: string
    providerId: string
    modelId: string
    temperature: number
  }>({
    name: '',
    description: '',
    systemPrompt: '',
    providerId: '',
    modelId: '',
    temperature: 0.7
  })

  const availableProviders = providers
    .filter((p) => p.isEnabled)
    .map((p) => ({
      ...p,
      models: p.models.filter(
        (m) =>
          m.isEnabled &&
          Array.isArray(m.capabilities) &&
          (m.capabilities.includes('chat') || m.capabilities.includes('reasoning'))
      )
    }))
    .filter((p) => p.models.length > 0)

  const startNewAgent = () => {
    const defaultProvider = availableProviders[0]
    const defaultModel = defaultProvider?.models[0]
    setEditForm({
      name: '',
      description: '',
      systemPrompt: '',
      providerId: defaultProvider?.id || '',
      modelId: defaultModel?.name || '',
      temperature: 0.7
    })
    selectAgent(null)
    setIsEditing(true)
  }

  // Receive systemPrompt from URL (e.g. from prompts page "apply to agent")
  useEffect(() => {
    if (search.systemPrompt) {
      const defaultProvider = availableProviders[0]
      const defaultModel = defaultProvider?.models[0]
      setEditForm({
        name: '',
        description: '',
        systemPrompt: search.systemPrompt,
        providerId: defaultProvider?.id || '',
        modelId: defaultModel?.name || '',
        temperature: 0.7
      })
      selectAgent(null)
      setIsEditing(true)
      // Clear the URL param so it doesn't re-trigger on re-renders
      navigate({ to: '/agents', search: {} })
    }
  }, [search.systemPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEditAgent = (agent: (typeof allAgents)[0]) => {
    setEditForm({
      name: agent.name.startsWith('agents.') ? t(agent.name) : agent.name,
      description: agent.description.startsWith('agents.') ? t(agent.description) : agent.description,
      systemPrompt: agent.systemPrompt,
      providerId: agent.providerId || availableProviders[0]?.id || '',
      modelId: agent.modelId || '',
      temperature: agent.temperature ?? 0.7
    })
    selectAgent(agent.id)
    setIsEditing(true)
  }

  const handleSave = () => {
    if (!editForm.name.trim() || !editForm.systemPrompt.trim()) return

    if (selectedAgent && !isPresetAgent(selectedAgent.id)) {
      updateAgent(selectedAgent.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        systemPrompt: editForm.systemPrompt.trim(),
        providerId: editForm.providerId || undefined,
        modelId: editForm.modelId || undefined,
        temperature: editForm.temperature
      })
    } else {
      createAgent({
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        systemPrompt: editForm.systemPrompt.trim(),
        providerId: editForm.providerId || undefined,
        modelId: editForm.modelId || undefined,
        temperature: editForm.temperature
      })
    }
    setIsEditing(false)
  }

  const handleUseAgent = async (agent: (typeof allAgents)[0]) => {
    const systemPrompt = agent.systemPrompt
    const providerId = agent.providerId || availableProviders[0]?.id
    const modelId = agent.modelId || availableProviders[0]?.models[0]?.name

    const sessionId = await createSession(providerId, modelId, systemPrompt)
    navigate({ to: '/chat', search: { session: sessionId } })
  }

  const handleDelete = (id: string) => {
    setDeleteTargetId(id)
  }

  const getAgentDisplayName = (agent: (typeof allAgents)[0]) => {
    if (agent.name.startsWith('agents.')) return t(agent.name)
    return agent.name
  }

  const getAgentDisplayDesc = (agent: (typeof allAgents)[0]) => {
    if (agent.description.startsWith('agents.')) return t(agent.description)
    return agent.description
  }

  const filteredPresetAgents = presetAgents.filter((agent) => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true
    return `${getAgentDisplayName(agent)} ${getAgentDisplayDesc(agent)}`.toLowerCase().includes(query)
  })

  const filteredCustomAgents = customAgents.filter((agent) => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true
    return `${agent.name} ${agent.description}`.toLowerCase().includes(query)
  })

  const getAgentIcon = (agent: (typeof allAgents)[0]) => {
    if (PRESET_ICONS[agent.id]) {
      return (
        <div
          className='w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/10 text-[var(--juhe-cyan)] flex items-center justify-center shrink-0'
          style={{ background: 'var(--juhe-void)' }}
        >
          {PRESET_ICONS[agent.id]}
        </div>
      )
    }
    return (
      <div className='w-9 h-9 rounded-lg bg-[var(--juhe-void-3)] text-[var(--juhe-text-2)] flex items-center justify-center shrink-0'>
        <UserCircle className='w-5 h-5' />
      </div>
    )
  }

  return (
    <div className='h-full flex'>
      {/* Left sidebar */}
      <div className='w-64 shrink-0 border-r border-[var(--juhe-border)] flex flex-col bg-[var(--juhe-surface)]/30'>
        {/* Header */}
        <div className='flex items-center justify-between p-3 border-b border-[var(--juhe-border)]'>
          <div className='flex items-center gap-2 min-w-0'>
            <Bot className='w-5 h-5 text-[var(--juhe-cyan)]' />
            <div className='min-w-0'>
              <h2 className='text-sm font-semibold truncate'>{t('agents.title')}</h2>
              <p className='text-[10px] text-[var(--juhe-text-3)] truncate'>{t('agents.subtitle')}</p>
            </div>
          </div>
          <button
            type='button'
            onClick={startNewAgent}
            className='p-1.5 rounded-md hover:bg-white/[0.03] transition-colors'
            title={t('agents.newAgent')}
          >
            <Plus className='w-4 h-4' />
          </button>
        </div>

        <div className='p-2 border-b border-[var(--juhe-border)]'>
          <div className='flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void)] text-[var(--juhe-text-3)]'>
            <Search className='w-3.5 h-3.5 shrink-0' />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('agents.searchPlaceholder')}
              className='w-full bg-transparent text-xs outline-none placeholder:text-[var(--juhe-text-3)]'
            />
          </div>
        </div>

        {/* Agent list */}
        <div className='flex-1 overflow-y-auto p-2 space-y-3'>
          {/* Preset agents */}
          <div>
            <div className='px-2 py-1 text-[10px] font-medium text-[var(--juhe-text-3)] uppercase tracking-wider'>
              {t('agents.presetAgents')}
            </div>
            <div className='space-y-0.5'>
              {filteredPresetAgents.map((agent) => (
                <button
                  type='button'
                  key={agent.id}
                  onClick={() => {
                    selectAgent(agent.id)
                    setIsEditing(false)
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${
                    selectedAgentId === agent.id && !isEditing
                      ? 'bg-white/[0.03] text-white'
                      : 'hover:bg-white/[0.03]/50 text-[var(--juhe-text)]'
                  }`}
                >
                  {getAgentIcon(agent)}
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium text-sm truncate'>{getAgentDisplayName(agent)}</div>
                    <div className='text-[10px] text-[var(--juhe-text-3)] truncate'>{getAgentDisplayDesc(agent)}</div>
                  </div>
                  <ChevronRight className='w-3.5 h-3.5 shrink-0 text-[var(--juhe-text-3)] opacity-0 group-hover:opacity-100' />
                </button>
              ))}
            </div>
          </div>

          {/* Custom agents */}
          <div>
            <div className='px-2 py-1 text-[10px] font-medium text-[var(--juhe-text-3)] uppercase tracking-wider'>
              {t('agents.customAgents')}
            </div>
            {filteredCustomAgents.length === 0 ? (
              <div className='px-2 py-4 text-xs text-[var(--juhe-text-3)] text-center'>{t('agents.noAgents')}</div>
            ) : (
              <div className='space-y-0.5'>
                {filteredCustomAgents.map((agent) => (
                  <button
                    type='button'
                    key={agent.id}
                    onClick={() => {
                      selectAgent(agent.id)
                      setIsEditing(false)
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors group ${
                      selectedAgentId === agent.id && !isEditing
                        ? 'bg-white/[0.03] text-white'
                        : 'hover:bg-white/[0.03]/50 text-[var(--juhe-text)]'
                    }`}
                  >
                    {getAgentIcon(agent)}
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-sm truncate'>{agent.name}</div>
                      <div className='text-[10px] text-[var(--juhe-text-3)] truncate'>{agent.description}</div>
                    </div>
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(agent.id)
                      }}
                      className='p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--juhe-magenta)]/10 hover:text-[var(--juhe-magenta)] transition-opacity shrink-0'
                      title={t('agents.deleteAgent')}
                    >
                      <Trash2 className='w-3 h-3' />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className='flex-1 flex flex-col min-w-0 bg-[var(--juhe-void-2)]'>
        {selectedAgent ? (
          <AgentDetail
            agent={selectedAgent}
            getAgentDisplayName={getAgentDisplayName}
            getAgentDisplayDesc={getAgentDisplayDesc}
            getAgentIcon={getAgentIcon}
            onEdit={() => startEditAgent(selectedAgent)}
            onUse={() => handleUseAgent(selectedAgent)}
            onDelete={!isPresetAgent(selectedAgent.id) ? () => handleDelete(selectedAgent.id) : undefined}
            t={t}
          />
        ) : (
          <div className='flex-1 flex flex-col items-center justify-center text-[var(--juhe-text-3)]'>
            <Bot className='w-12 h-12 mb-3 opacity-20' />
            <p className='text-sm'>{t('agents.noAgents')}</p>
            <button
              type='button'
              onClick={startNewAgent}
              className='mt-4 px-4 py-2 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-sm hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
            >
              {t('agents.newAgent')}
            </button>
          </div>
        )}
      </div>

      <AgentEditorDialog
        open={isEditing}
        form={editForm}
        setForm={setEditForm}
        onSave={handleSave}
        onOpenChange={(open) => {
          setIsEditing(open)
          if (!open && !selectedAgent) selectAgent(null)
        }}
        onOpenPromptSelector={() => setPromptDrawerOpen(true)}
        isNew={!selectedAgent || isPresetAgent(selectedAgent.id)}
        availableProviders={availableProviders}
        t={t}
      />

      <ConfirmModal
        open={deleteTargetId !== null}
        title={t('agents.confirmDelete') as string}
        description={t('agents.confirmDelete') as string}
        confirmText={t('common.delete') as string}
        cancelText={t('common.cancel') as string}
        danger
        onConfirm={() => {
          if (deleteTargetId) {
            deleteAgent(deleteTargetId)
            if (selectedAgentId === deleteTargetId) {
              setIsEditing(false)
            }
          }
          setDeleteTargetId(null)
        }}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* Prompt selector drawer */}
      <PromptSelectorDrawer
        type='agent'
        open={promptDrawerOpen}
        onSelect={(content) => {
          setEditForm((prev) => ({ ...prev, systemPrompt: content }))
        }}
        onClose={() => setPromptDrawerOpen(false)}
      />
    </div>
  )
}

function AgentEditorDialog({
  open,
  form,
  setForm,
  onSave,
  onOpenChange,
  onOpenPromptSelector,
  isNew,
  availableProviders,
  t
}: {
  open: boolean
  form: {
    name: string
    description: string
    systemPrompt: string
    providerId: string
    modelId: string
    temperature: number
  }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
  onSave: () => void
  onOpenChange: (open: boolean) => void
  onOpenPromptSelector: () => void
  isNew: boolean
  availableProviders: Provider[]
  t: (key: string) => string
}) {
  const selectedProvider = availableProviders.find((p: Provider) => p.id === form.providerId)
  const availableModels = selectedProvider?.models || []

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        size='lg'
        className='max-h-[90vh] overflow-hidden bg-[var(--juhe-void-2)] border-[var(--juhe-border)]'
      >
        <DialogHeader className='text-left'>
          <DialogTitle className='text-[var(--juhe-text)]'>
            {isNew ? t('agents.newAgent') : t('agents.editAgent')}
          </DialogTitle>
          <DialogDescription className='text-[var(--juhe-text-3)]'>
            {t('agents.systemPromptPlaceholder')}
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[calc(90vh-11rem)] overflow-y-auto pr-1 space-y-5'>
          {/* Name */}
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

          {/* Description */}
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

          {/* System Prompt */}
          <div className='space-y-1.5'>
            <div className='flex items-center justify-between'>
              <label className='text-sm font-medium'>{t('agents.systemPrompt')}</label>
              <button
                type='button'
                onClick={() => onOpenPromptSelector()}
                className='inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-[var(--juhe-cyan)] hover:bg-[var(--juhe-cyan)]/10 transition-colors'
              >
                <BookOpen className='w-3 h-3' />
                {t('prompts.selectFromLibrary')}
              </button>
            </div>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              placeholder={t('agents.systemPromptPlaceholder')}
              rows={8}
              className='w-full px-3 py-2 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-sm placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 focus:border-[var(--juhe-cyan)]/50 transition-colors resize-none'
            />
          </div>

          {/* Model Selection */}
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>{t('agents.model')}</label>
              <select
                value={form.providerId}
                onChange={(e) => {
                  const providerId = e.target.value
                  const provider = availableProviders.find((p: Provider) => p.id === providerId)
                  const model = provider?.models[0]
                  setForm((f) => ({
                    ...f,
                    providerId,
                    modelId: model?.name || ''
                  }))
                }}
                className='w-full px-3 py-2 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 focus:border-[var(--juhe-cyan)]/50 transition-colors'
              >
                <option value=''>{t('generate.modelSelector.selectProvider')}</option>
                {availableProviders.map((p: Provider) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>{t('generate.modelSelector.model')}</label>
              <select
                value={form.modelId}
                onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                className='w-full px-3 py-2 rounded-lg bg-[var(--juhe-surface)] border border-[var(--juhe-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--juhe-cyan)]/30 focus:border-[var(--juhe-cyan)]/50 transition-colors'
              >
                <option value=''>{t('generate.modelSelector.selectModel')}</option>
                {availableModels.map((m: Provider['models'][0]) => (
                  <option key={m.id} value={m.name}>
                    {m.displayName || m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Temperature */}
          <div className='space-y-1.5'>
            <div className='flex items-center justify-between'>
              <label className='text-sm font-medium'>{t('agents.temperature')}</label>
              <span className='text-xs text-[var(--juhe-text-3)]'>{form.temperature.toFixed(1)}</span>
            </div>
            <input
              type='range'
              min={0}
              max={2}
              step={0.1}
              value={form.temperature}
              onChange={(e) => setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
              className='w-full'
            />
            <div className='flex justify-between text-[10px] text-[var(--juhe-text-3)]'>
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>
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
            disabled={!form.name.trim() || !form.systemPrompt.trim()}
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

function AgentDetail({
  agent,
  getAgentDisplayName,
  getAgentDisplayDesc,
  getAgentIcon,
  onEdit,
  onUse,
  onDelete,
  t
}: {
  agent: ReturnType<typeof getAllAgents>[0]
  getAgentDisplayName: (a: typeof agent) => string
  getAgentDisplayDesc: (a: typeof agent) => string
  getAgentIcon: (a: typeof agent) => React.ReactNode
  onEdit: () => void
  onUse: () => void
  onDelete?: () => void
  t: (key: string) => string
}) {
  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='flex items-center justify-between px-6 py-4 border-b border-[var(--juhe-border)]'>
        <div className='flex items-center gap-3'>
          {getAgentIcon(agent)}
          <div>
            <h1 className='text-lg font-semibold'>{getAgentDisplayName(agent)}</h1>
            <p className='text-xs text-[var(--juhe-text-3)]'>{getAgentDisplayDesc(agent)}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={onEdit}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
          >
            <Sparkles className='w-4 h-4' />
            {t('common.edit')}
          </button>
          {onDelete && (
            <button
              type='button'
              onClick={onDelete}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--juhe-magenta)] hover:bg-[var(--juhe-magenta)]/10 transition-colors'
            >
              <Trash2 className='w-4 h-4' />
              {t('agents.deleteAgent')}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-6 py-6 space-y-5'>
        {/* System Prompt */}
        <div className='space-y-1.5'>
          <label className='text-sm font-medium'>{t('agents.systemPrompt')}</label>
          <div className='px-4 py-3 rounded-lg bg-[var(--juhe-surface-2)]/50 border border-[var(--juhe-border)]'>
            <p className='text-sm text-[var(--juhe-text-2)] leading-relaxed whitespace-pre-wrap'>
              {agent.systemPrompt}
            </p>
          </div>
        </div>

        {/* Model info */}
        {(agent.providerId || agent.modelId) && (
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>{t('agents.model')}</label>
            <div className='flex gap-2'>
              {agent.providerId && (
                <span className='inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--juhe-void-3)] text-[var(--juhe-text-2)] text-xs'>
                  {agent.providerId}
                </span>
              )}
              {agent.modelId && (
                <span className='inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--juhe-void-3)] text-[var(--juhe-text-2)] text-xs'>
                  {agent.modelId}
                </span>
              )}
            </div>
          </div>
        )}

        {agent.temperature !== undefined && (
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>{t('agents.temperature')}</label>
            <div className='flex items-center gap-3'>
              <input type='range' min={0} max={2} step={0.1} value={agent.temperature} disabled className='w-48' />
              <span className='text-sm text-[var(--juhe-text-3)]'>{agent.temperature.toFixed(1)}</span>
            </div>
          </div>
        )}

        {/* Use Agent */}
        <div className='pt-4'>
          <button
            type='button'
            onClick={onUse}
            className='inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white text-sm font-medium hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
          >
            <MessageSquare className='w-4 h-4' />
            {t('agents.useAgent')}
          </button>
        </div>
      </div>
    </div>
  )
}
