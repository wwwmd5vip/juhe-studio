import { useProviderStore } from '@renderer/stores/providers'
import type { CreateProviderRequest, UpdateProviderRequest } from '@shared/types/provider'
import { getPresetById, PROVIDER_PRESETS } from '@shared/utils/provider-presets'
import { Check, ChevronLeft, ExternalLink, Eye, EyeOff, Loader2, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ProviderFormProps {
  onClose: () => void
}

export function ProviderForm({ onClose }: ProviderFormProps) {
  const { t } = useTranslation()
  const createProvider = useProviderStore((s) => s.createProvider)
  const updateProvider = useProviderStore((s) => s.updateProvider)
  const deleteProvider = useProviderStore((s) => s.deleteProvider)
  const testConnection = useProviderStore((s) => s.testConnection)
  const selectProvider = useProviderStore((s) => s.selectProvider)
  const editingProvider = useProviderStore((s) => s.editingProvider)
  const setEditingProvider = useProviderStore((s) => s.setEditingProvider)

  const isEditing = Boolean(editingProvider)

  const [step, setStep] = useState<'select' | 'configure'>(isEditing ? 'configure' : 'select')
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(editingProvider?.presetId ?? null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<CreateProviderRequest>({
    name: '',
    type: '',
    baseUrl: '',
    apiKey: '',
    accessKeyId: '',
    secretAccessKey: '',
    isEnabled: true
  })

  const preset = useMemo(() => getPresetById(selectedPresetId ?? ''), [selectedPresetId])
  const isDualKey = preset?.authType === 'dualKey'

  // Reset form when opening
  useEffect(() => {
    if (editingProvider) {
      setStep('configure')
      setSelectedPresetId(editingProvider.presetId ?? null)
      setForm({
        name: editingProvider.name,
        type: editingProvider.type,
        baseUrl: editingProvider.baseUrl ?? '',
        apiKey: '', // Leave empty so user can update if needed
        accessKeyId: '',
        secretAccessKey: '',
        isEnabled: editingProvider.isEnabled,
        presetId: editingProvider.presetId ?? undefined
      })
    } else {
      setStep('select')
      setSelectedPresetId(null)
      setForm({ name: '', type: '', baseUrl: '', apiKey: '', accessKeyId: '', secretAccessKey: '', isEnabled: true })
    }
    setTestResult(null)
    setError(null)
  }, [editingProvider])

  const handleClose = () => {
    setEditingProvider(null)
    onClose()
  }

  const handleSelectPreset = (presetId: string) => {
    const p = getPresetById(presetId)
    if (!p) return
    setSelectedPresetId(presetId)
    setForm({
      name: p.name,
      type: p.type,
      baseUrl: p.defaultBaseUrl,
      apiKey: '',
      accessKeyId: '',
      secretAccessKey: '',
      isEnabled: true,
      presetId: p.id
    })
    setStep('configure')
  }

  const handleTest = async () => {
    if (!form.baseUrl) return
    setIsTesting(true)
    setTestResult(null)
    let tempProviderId: string | null = null
    try {
      if (isEditing && editingProvider) {
        const result = await testConnection(editingProvider.id)
        setTestResult(result)
      } else {
        // Create a temporary provider to test, then clean up
        const temp = await createProvider({ ...form, isEnabled: false })
        tempProviderId = temp.id
        const result = await testConnection(temp.id)
        setTestResult(result)
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed'
      })
    } finally {
      // Clean up temporary provider to avoid orphan records
      if (tempProviderId) {
        try {
          await deleteProvider(tempProviderId)
        } catch {
          // Best-effort cleanup; ignore if already deleted
        }
      }
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.baseUrl.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      if (isEditing && editingProvider) {
        const payload: UpdateProviderRequest = {
          id: editingProvider.id,
          name: form.name,
          type: form.type,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey || undefined,
          accessKeyId: form.accessKeyId || undefined,
          secretAccessKey: form.secretAccessKey || undefined,
          isEnabled: form.isEnabled,
          presetId: form.presetId
        }
        await updateProvider(payload)
        selectProvider(editingProvider.id)
      } else {
        const created = await createProvider(form)
        selectProvider(created.id)
      }
      handleClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : isEditing ? 'Failed to update provider' : 'Failed to create provider'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = form.name.trim().length > 0 && form.baseUrl.trim().length > 0

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
      <div className='flex w-full max-w-lg flex-col rounded-xl border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] shadow-xl max-h-[85vh]'>
        {/* Header */}
        <div className='flex items-center gap-3 border-b border-[var(--juhe-border)] px-5 py-4'>
          {step === 'configure' && !isEditing && (
            <button
              type='button'
              onClick={() => setStep('select')}
              className='rounded-md p-1 text-[var(--juhe-text-3)] transition-colors hover:bg-[var(--juhe-surface-2)] hover:text-[var(--juhe-text)]'
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <h3 className='text-base font-semibold'>
            {isEditing
              ? t('providerSettings.editProvider', { defaultValue: 'Edit Provider' })
              : step === 'select'
                ? t('providerSettings.selectProvider')
                : t('providerSettings.configureProvider')}
          </h3>
          <button
            type='button'
            onClick={handleClose}
            className='ml-auto rounded-md p-1 text-[var(--juhe-text-3)] transition-colors hover:bg-[var(--juhe-surface-2)] hover:text-[var(--juhe-text)]'
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className='min-h-0 flex-1 overflow-y-auto p-5'>
          {error && (
            <div className='mb-4 rounded-lg bg-[var(--juhe-magenta)]/10 p-3 text-sm text-[var(--juhe-magenta)]'>
              {error}
            </div>
          )}

          {step === 'select' && !isEditing ? (
            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
              {PROVIDER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type='button'
                  onClick={() => handleSelectPreset(p.id)}
                  className='flex items-start gap-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-surface)] p-3 text-left transition-colors hover:border-[var(--juhe-cyan)]/50 hover:bg-[var(--juhe-surface-2)]/20'
                >
                  <div
                    className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold'
                    style={{
                      backgroundColor: stringToColor(p.name),
                      color: '#fff'
                    }}
                  >
                    {p.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='font-medium text-[var(--juhe-text)]'>{p.name}</div>
                    <div className='text-xs text-[var(--juhe-text-3)] line-clamp-2'>{p.description}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // biome-ignore lint/correctness/useUniqueElementIds: ignored using `--suppress`
<form id='provider-form' onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-1.5'>
                <label htmlFor='provider-name' className='text-sm font-medium text-[var(--juhe-text)]'>
                  {t('providerSettings.name', { defaultValue: 'Name' })}
                </label>
                <input
                  id='provider-name'
                  type='text'
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-2 text-sm text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                  required
                />
              </div>

              <div className='space-y-1.5'>
                <label htmlFor='provider-base-url' className='text-sm font-medium text-[var(--juhe-text)]'>{t('providerSettings.baseUrl')}</label>
                <input
                  id='provider-base-url'
                  type='url'
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  placeholder={preset?.defaultBaseUrl}
                  className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-2 text-sm text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                  required
                />
                {preset && (
                  <p className='text-xs text-[var(--juhe-text-3)]'>
                    {t('providerSettings.default', { defaultValue: 'Default' })}: {preset.defaultBaseUrl}
                  </p>
                )}
              </div>

              {isDualKey ? (
                <>
                  {/* Access Key ID */}
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between'>
                      <label htmlFor='provider-access-key-id' className='text-sm font-medium text-[var(--juhe-text)]'>
                        {t('providerSettings.accessKeyId', { defaultValue: 'Access Key ID' })}
                      </label>
                      {preset?.apiKeyUrl && (
                        <a
                          href={preset.apiKeyUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='flex items-center gap-0.5 text-xs text-[var(--juhe-cyan)] hover:underline'
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('providerSettings.getApiKey')}
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <div className='relative'>
                      <input
                        id='provider-access-key-id'
                        type={showApiKey ? 'text' : 'password'}
                        value={form.accessKeyId}
                        onChange={(e) => setForm((f) => ({ ...f, accessKeyId: e.target.value }))}
                        placeholder={
                          isEditing
                            ? t('providerSettings.unchangedPlaceholder', {
                                defaultValue: 'Leave blank to keep unchanged'
                              })
                            : 'AK...'
                        }
                        className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-2 pr-9 text-sm text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                      />
                      <button
                        type='button'
                        onClick={() => setShowApiKey((v) => !v)}
                        className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--juhe-text-3)] transition-colors hover:bg-[var(--juhe-surface-2)] hover:text-[var(--juhe-text)]'
                      >
                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Secret Access Key */}
                  <div className='space-y-1.5'>
                    <label htmlFor='provider-secret-access-key' className='text-sm font-medium text-[var(--juhe-text)]'>
                      {t('providerSettings.secretAccessKey', { defaultValue: 'Secret Access Key' })}
                    </label>
                    <div className='relative'>
                      <input
                        id='provider-secret-access-key'
                        type={showSecretKey ? 'text' : 'password'}
                        value={form.secretAccessKey}
                        onChange={(e) => setForm((f) => ({ ...f, secretAccessKey: e.target.value }))}
                        placeholder={
                          isEditing
                            ? t('providerSettings.unchangedPlaceholder', {
                                defaultValue: 'Leave blank to keep unchanged'
                              })
                            : 'SK...'
                        }
                        className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-2 pr-9 text-sm text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                      />
                      <button
                        type='button'
                        onClick={() => setShowSecretKey((v) => !v)}
                        className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--juhe-text-3)] transition-colors hover:bg-[var(--juhe-surface-2)] hover:text-[var(--juhe-text)]'
                      >
                        {showSecretKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Single API Key */
                <div className='space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <label htmlFor='provider-api-key' className='text-sm font-medium text-[var(--juhe-text)]'>
                      {t('providerSettings.apiKey')}
                    </label>
                    {preset?.apiKeyUrl && (
                      <a
                        href={preset.apiKeyUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-center gap-0.5 text-xs text-[var(--juhe-cyan)] hover:underline'
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('providerSettings.getApiKey')}
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  <div className='relative'>
                    <input
                      id='provider-api-key'
                      type={showApiKey ? 'text' : 'password'}
                      value={form.apiKey}
                      onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                      placeholder={
                        isEditing
                          ? t('providerSettings.unchangedPlaceholder', {
                              defaultValue: 'Leave blank to keep unchanged'
                            })
                          : 'sk-...'
                      }
                      className='w-full rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] px-3 py-2 pr-9 text-sm text-[var(--juhe-text)] placeholder:text-[var(--juhe-text-3)] focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
                    />
                    <button
                      type='button'
                      onClick={() => setShowApiKey((v) => !v)}
                      className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--juhe-text-3)] transition-colors hover:bg-[var(--juhe-surface-2)] hover:text-[var(--juhe-text)]'
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <label className='flex cursor-pointer items-center gap-2'>
                <input
                  type='checkbox'
                  checked={form.isEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
                  className='h-4 w-4 rounded border-[var(--juhe-border)] accent-primary'
                />
                <span className='text-sm text-[var(--juhe-text)]'>
                  {t('providerSettings.enabled', { defaultValue: 'Enabled' })}
                </span>
              </label>

              {testResult && (
                <div
                  className={`flex items-center gap-2 rounded-lg p-3 text-sm
                    ${testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)]'}`}
                >
                  {testResult.success ? <Check size={16} /> : <X size={16} />}
                  {testResult.message}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {step === 'configure' && (
          <div className='flex items-center justify-end gap-2 border-t border-[var(--juhe-border)] px-5 py-4'>
            <button
              type='button'
              onClick={handleTest}
              disabled={isTesting || !form.baseUrl.trim()}
              className='flex items-center gap-1.5 rounded-lg border border-[var(--juhe-border)] px-3 py-2 text-sm font-medium text-[var(--juhe-text)] transition-colors hover:bg-[var(--juhe-surface-2)] disabled:opacity-50'
            >
              {isTesting ? <Loader2 size={14} className='animate-spin' /> : <Zap size={14} />}
              {isTesting ? t('providerSettings.testing') : t('providerSettings.testConnection')}
            </button>
            <button
              type='button'
              onClick={handleClose}
              className='rounded-lg px-3 py-2 text-sm font-medium text-[var(--juhe-text-3)] transition-colors hover:bg-[var(--juhe-surface-2)] hover:text-[var(--juhe-text)]'
            >
              {t('common.cancel')}
            </button>
            <button
              type='submit'
              form='provider-form'
              disabled={!canSubmit || isSubmitting}
              className='rounded-lg bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] px-4 py-2 text-sm font-medium text-[var(--juhe-cyan)]-foreground transition-colors hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 disabled:opacity-50'
            >
              {isSubmitting ? (
                <span className='flex items-center gap-1.5'>
                  <Loader2 size={14} className='animate-spin' />
                  {t('common.loading')}
                </span>
              ) : (
                t(isEditing ? 'common.save' : 'common.add')
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue} 70% 45%)`
}
