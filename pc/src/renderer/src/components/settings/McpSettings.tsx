/**
 * MCP server management panel
 */

import { Loader2, Plus, Save, TestTube, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type McpServerConfig, type McpTransportType, useMcpStore } from '@/stores/mcp'

const TRANSPORT_TYPES: McpTransportType[] = ['stdio', 'sse', 'streamable-http']

function generateId() {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function McpSettings() {
  const { t } = useTranslation()
  const { servers, isLoading, error, loadServers, saveServers, deleteServer, testServer, clearError } = useMcpStore()
  const [drafts, setDrafts] = useState<McpServerConfig[]>([])
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message?: string }>>({})

  useEffect(() => {
    loadServers()
  }, [loadServers])

  useEffect(() => {
    setDrafts(servers)
  }, [servers])

  const updateDraft = (id: string, patch: Partial<McpServerConfig>) => {
    setDrafts((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const updateEnv = (id: string, envText: string) => {
    try {
      const parsed = envText ? JSON.parse(envText) : {}
      updateDraft(id, { env: parsed })
    } catch {
      // ignore invalid JSON while typing
    }
  }

  const addServer = () => {
    setDrafts((prev) => [
      ...prev,
      {
        id: generateId(),
        name: t('settings.mcp.newServer'),
        enabled: true,
        transport: 'stdio',
        command: '',
        args: [],
        env: {}
      }
    ])
  }

  const removeServer = async (id: string) => {
    if (servers.some((s) => s.id === id)) {
      await deleteServer(id)
    }
    setDrafts((prev) => prev.filter((s) => s.id !== id))
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleSave = async () => {
    await saveServers(drafts)
    setTestResults({})
  }

  const handleTest = async (config: McpServerConfig) => {
    setTestingId(config.id)
    setTestResults((prev) => ({ ...prev, [config.id]: { success: false } }))
    const result = await testServer(config)
    setTestResults((prev) => ({
      ...prev,
      [config.id]: {
        success: result.success,
        message: result.success ? t('settings.mcp.testSuccess', { count: result.tools?.length || 0 }) : result.error
      }
    }))
    setTestingId(null)
  }

  return (
    <div className='max-w-3xl space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>{t('settings.mcp.title')}</h2>
          <p className='text-xs text-[var(--juhe-text-3)]'>{t('settings.mcp.description')}</p>
        </div>
        <button
          type='button'
          onClick={addServer}
          className='inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] px-3 py-1.5 text-sm text-white hover:opacity-90 transition-opacity'
        >
          <Plus className='w-4 h-4' />
          {t('settings.mcp.addServer')}
        </button>
      </div>

      {error && (
        <div className='rounded-lg border border-[var(--juhe-magenta)]/20 bg-[var(--juhe-magenta)]/5 p-3 text-sm text-[var(--juhe-magenta)]'>
          {error}
          <button type='button' onClick={clearError} className='ml-2 underline'>
            {t('common.close')}
          </button>
        </div>
      )}

      <div className='space-y-4'>
        {drafts.length === 0 && (
          <div className='rounded-lg border border-dashed border-[var(--juhe-border)] p-8 text-center text-sm text-[var(--juhe-text-3)]'>
            {t('settings.mcp.empty')}
          </div>
        )}

        {drafts.map((server) => (
          <div
            key={server.id}
            className='rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-surface)] p-4 space-y-3'
          >
            <div className='flex items-center gap-3'>
              <input
                type='checkbox'
                checked={server.enabled}
                onChange={(e) => updateDraft(server.id, { enabled: e.target.checked })}
                className='rounded border-[var(--juhe-border)] text-[var(--juhe-cyan)]'
              />
              <input
                type='text'
                value={server.name}
                onChange={(e) => updateDraft(server.id, { name: e.target.value })}
                placeholder={t('settings.mcp.serverName')}
                className='flex-1 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
              />
              <select
                value={server.transport}
                onChange={(e) => updateDraft(server.id, { transport: e.target.value as McpTransportType })}
                className='rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
              >
                {TRANSPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type='button'
                onClick={() => removeServer(server.id)}
                className='rounded-lg p-1.5 text-[var(--juhe-magenta)] hover:bg-[var(--juhe-magenta)]/10'
              >
                <Trash2 className='w-4 h-4' />
              </button>
            </div>

            {server.transport === 'stdio' ? (
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <input
                  type='text'
                  value={server.command || ''}
                  onChange={(e) => updateDraft(server.id, { command: e.target.value })}
                  placeholder={t('settings.mcp.command')}
                  className='rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                />
                <input
                  type='text'
                  value={(server.args || []).join(' ')}
                  onChange={(e) =>
                    updateDraft(server.id, {
                      args: e.target.value.split(' ').filter(Boolean)
                    })
                  }
                  placeholder={t('settings.mcp.args')}
                  className='rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                />
              </div>
            ) : (
              <input
                type='text'
                value={server.url || ''}
                onChange={(e) => updateDraft(server.id, { url: e.target.value })}
                placeholder={t('settings.mcp.url')}
                className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
              />
            )}

            <textarea
              value={server.env ? JSON.stringify(server.env, null, 2) : ''}
              onChange={(e) => updateEnv(server.id, e.target.value)}
              placeholder={t('settings.mcp.env')}
              rows={3}
              className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-1.5 text-sm font-mono text-xs placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)] resize-none'
            />

            <div className='flex items-center justify-between'>
              <div className='text-xs'>
                {testResults[server.id]?.message && (
                  <span
                    className={
                      testResults[server.id]?.success ? 'text-[var(--juhe-emerald)]' : 'text-[var(--juhe-magenta)]'
                    }
                  >
                    {testResults[server.id]?.message}
                  </span>
                )}
              </div>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => handleTest(server)}
                  disabled={testingId === server.id}
                  className='inline-flex items-center gap-1.5 rounded-lg border border-[var(--juhe-border)] px-3 py-1.5 text-xs font-medium text-[var(--juhe-text)] hover:bg-[var(--juhe-surface-2)] disabled:opacity-50'
                >
                  {testingId === server.id ? (
                    <Loader2 className='w-3.5 h-3.5 animate-spin' />
                  ) : (
                    <TestTube className='w-3.5 h-3.5' />
                  )}
                  {t('settings.mcp.test')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {drafts.length > 0 && (
        <div className='flex justify-end'>
          <button
            type='button'
            onClick={handleSave}
            disabled={isLoading}
            className='inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity'
          >
            <Save className='w-4 h-4' />
            {t('common.save')}
          </button>
        </div>
      )}
    </div>
  )
}
