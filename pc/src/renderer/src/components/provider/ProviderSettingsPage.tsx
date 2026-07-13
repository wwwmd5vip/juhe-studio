import { useProviderStore } from '@renderer/stores/providers'
import { useEffect, useMemo, useState } from 'react'
import { ProviderDetail } from './ProviderDetail'
import { ProviderForm } from './ProviderForm'
import { ProviderList } from './ProviderList'

interface ProviderSettingsPageProps {
  isOnboarding?: boolean
}

export default function ProviderSettingsPage({ isOnboarding = false }: ProviderSettingsPageProps) {
  const providers = useProviderStore((s) => s.providers)
  const selectedProviderId = useProviderStore((s) => s.selectedProviderId)
  const selectProvider = useProviderStore((s) => s.selectProvider)
  const loadProviders = useProviderStore((s) => s.loadProviders)
  const showAddModal = useProviderStore((s) => s.showAddModal)
  const setShowAddModal = useProviderStore((s) => s.setShowAddModal)
  const editingProvider = useProviderStore((s) => s.editingProvider)
  const setEditingProvider = useProviderStore((s) => s.setEditingProvider)

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  const visibleProviders = useMemo(() => providers.filter((p) => !p.isCustom || p.id !== 'system'), [providers])

  // Auto-select first provider if none selected
  useEffect(() => {
    if (!selectedProviderId && visibleProviders.length > 0) {
      const fallback =
        lastSelectedId && visibleProviders.some((p) => p.id === lastSelectedId)
          ? lastSelectedId
          : visibleProviders[0]?.id
      if (fallback) {
        selectProvider(fallback)
      }
    }
  }, [selectedProviderId, visibleProviders, selectProvider, lastSelectedId])

  // Persist last selection
  useEffect(() => {
    if (selectedProviderId) {
      setLastSelectedId(selectedProviderId)
    }
  }, [selectedProviderId])

  const selectedProvider = useMemo(
    () => visibleProviders.find((p) => p.id === selectedProviderId),
    [visibleProviders, selectedProviderId]
  )

  return (
    <div className='relative flex h-full min-h-0 w-full min-w-0 overflow-hidden'>
      <ProviderList />
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        {selectedProvider ? (
          <ProviderDetail providerId={selectedProvider.id} key={selectedProvider.id} isOnboarding={isOnboarding} />
        ) : (
          <div className='flex h-full items-center justify-center text-sm text-[var(--juhe-text-3)]'>
            No providers configured
          </div>
        )}
      </div>
      {(showAddModal || editingProvider) && (
        <ProviderForm
          onClose={() => {
            setShowAddModal(false)
            setEditingProvider(null)
          }}
        />
      )}
    </div>
  )
}
