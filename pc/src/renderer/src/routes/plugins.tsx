import { createFileRoute } from '@tanstack/react-router'
import { Box, Puzzle } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { type Plugin, usePluginStore } from '@/stores/plugins'

export const Route = createFileRoute('/plugins')({
  component: PluginsPage
})

function getPluginIcon(plugin: Plugin) {
  if (plugin.icon) {
    return (
      <div className='w-10 h-10 rounded-lg bg-[var(--juhe-void)] text-[var(--juhe-cyan)] flex items-center justify-center shrink-0 text-lg'>
        {plugin.icon}
      </div>
    )
  }
  return (
    <div className='w-10 h-10 rounded-lg bg-[var(--juhe-void-3)] text-[var(--juhe-text-2)] flex items-center justify-center shrink-0'>
      <Box className='w-5 h-5' />
    </div>
  )
}

function PluginsPage() {
  const { t } = useTranslation()
  const { plugins, loading, loadPlugins, togglePlugin } = usePluginStore()

  useEffect(() => {
    loadPlugins()
  }, [loadPlugins])

  return (
    <div className='h-full flex flex-col bg-[var(--juhe-void-2)]'>
      {/* Header */}
      <div className='flex items-center justify-between px-6 py-4 border-b border-[var(--juhe-border)] shrink-0'>
        <div className='flex items-center gap-2'>
          <Puzzle className='w-5 h-5 text-[var(--juhe-cyan)]' />
          <h1 className='text-lg font-semibold'>{t('plugins.title')}</h1>
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-6 py-6'>
        {loading ? (
          <div className='flex items-center justify-center py-20'>
            <div className='w-6 h-6 border-2 border-[var(--juhe-cyan)]/30 border-t-[var(--juhe-cyan)] rounded-full animate-spin' />
          </div>
        ) : plugins.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-20 text-[var(--juhe-text-3)]'>
            <Box className='w-12 h-12 mb-3 opacity-20' />
            <p className='text-sm mb-1'>{t('plugins.empty', '暂无插件，安装插件扩展功能')}</p>
          </div>
        ) : (
          <section>
            <h2 className='text-sm font-semibold text-[var(--juhe-text-3)] uppercase tracking-wider mb-3 flex items-center gap-2'>
              <Puzzle className='w-4 h-4' />
              {t('plugins.installed')}
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
              {plugins.map((plugin) => (
                <PluginCard key={plugin.id} plugin={plugin} t={t} onToggle={() => togglePlugin(plugin.id)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function PluginCard({ plugin, t, onToggle }: { plugin: Plugin; t: (key: string) => string; onToggle: () => void }) {
  return (
    <div
      className={`relative p-4 rounded-xl border transition-colors ${
        plugin.isActive
          ? 'bg-[var(--juhe-surface)] border-[var(--juhe-border)]'
          : 'bg-[var(--juhe-surface-2)]/30 border-[var(--juhe-border)]/50 opacity-70'
      }`}
    >
      <div className='flex items-start gap-3'>
        {getPluginIcon(plugin)}
        <div className='flex-1 min-w-0'>
          <h3 className='text-sm font-semibold truncate'>{plugin.name}</h3>
          <p className='text-xs text-[var(--juhe-text-3)] mt-0.5 line-clamp-2'>{plugin.description}</p>
          <div className='flex items-center gap-2 mt-2 text-[10px] text-[var(--juhe-text-3)]'>
            <span>v{plugin.version}</span>
          </div>
        </div>
      </div>

      <div className='flex items-center justify-end mt-3 pt-3 border-t border-[var(--juhe-border)]/50'>
        <button
          type='button'
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            plugin.isActive
              ? 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]'
              : 'bg-[var(--juhe-surface-2)]'
          }`}
          title={plugin.isActive ? t('plugins.deactivate') : t('plugins.activate')}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              plugin.isActive ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

export default PluginsPage
