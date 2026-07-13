import { Check, Copy, Loader2, Upload, Wand2, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '@/stores/chat'
import { useProviderStore } from '@/stores/providers'

interface PromptReverseProps {
  onApply: (prompt: string) => void
}

export default function PromptReverse({ onApply }: PromptReverseProps) {
  const { t } = useTranslation()
  const { providers } = useProviderStore()
  const { createSession, sendMessage, selectSession } = useChatStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [image, setImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Find vision-capable providers
  const visionProviders = providers
    .filter((p) => p.isEnabled)
    .map((p) => ({
      ...p,
      models: p.models.filter((m) => m.isEnabled && Array.isArray(m.capabilities) && m.capabilities.includes('vision'))
    }))
    .filter((p) => p.models.length > 0)

  const [selectedProviderId, setSelectedProviderId] = useState(visionProviders[0]?.id || '')
  const [selectedModel, setSelectedModel] = useState(visionProviders[0]?.models.find((m) => m.isEnabled)?.name || '')

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        setError(t('promptReverse.errorNotImage'))
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        setImage(event.target?.result as string)
        setResult('')
        setError(null)
      }
      reader.readAsDataURL(file)
    },
    [t]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        setError(t('promptReverse.errorNotImage'))
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        setImage(event.target?.result as string)
        setResult('')
        setError(null)
      }
      reader.readAsDataURL(file)
    },
    [t]
  )

  const handleAnalyze = async () => {
    if (!image) return

    if (!selectedProviderId || !selectedModel) {
      setError(t('promptReverse.errorNoProvider'))
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      // Create a temporary chat session
      const sessionId = await createSession(selectedProviderId, selectedModel)

      // Send the analyze prompt with image as attachment
      const analyzePrompt = t('promptReverse.analyzePrompt')
      await sendMessage(analyzePrompt, selectedProviderId, selectedModel, [{ type: 'image', url: image }])

      // Poll for response
      let attempts = 0
      const maxAttempts = 60

      const checkResponse = async (): Promise<string> => {
        await selectSession(sessionId)
        const messages = await window.api.chat.listMessages(sessionId)
        const msgArray = messages as Array<{ role: string; content: string }>
        const assistantMessages = msgArray.filter((m) => m.role === 'assistant')
        if (assistantMessages.length > 0) {
          return assistantMessages[assistantMessages.length - 1].content
        }
        if (attempts >= maxAttempts) {
          throw new Error(t('promptReverse.errorTimeout'))
        }
        attempts++
        await new Promise((r) => setTimeout(r, 1000))
        return checkResponse()
      }

      const response = await checkResponse()
      setResult(response)

      // Clean up session
      await window.api.chat.deleteSession(sessionId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedProvider = visionProviders.find((p) => p.id === selectedProviderId)
  const availableModels = selectedProvider?.models.filter((m) => m.isEnabled) || []

  return (
    <div className='h-full flex flex-col bg-[var(--juhe-surface)]'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
        <h3 className='font-semibold text-sm flex items-center gap-2 text-[var(--juhe-text)]'>
          <Wand2 className='w-4 h-4 text-[var(--juhe-cyan)]' />
          {t('promptReverse.title')}
        </h3>
      </div>

      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {/* Provider Selection */}
        {visionProviders.length > 0 ? (
          <div className='space-y-2'>
            <label className='text-xs text-[var(--juhe-text-3)]'>{t('promptReverse.selectProvider')}</label>
            <select
              value={selectedProviderId}
              onChange={(e) => {
                setSelectedProviderId(e.target.value)
                const p = visionProviders.find((vp) => vp.id === e.target.value)
                setSelectedModel(p?.models.find((m) => m.isEnabled)?.name || '')
              }}
              className='w-full px-2 py-1.5 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)]
                         focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
            >
              <option value=''>{t('promptReverse.selectProviderPlaceholder')}</option>
              {visionProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {selectedProviderId && availableModels.length > 0 && (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className='w-full px-2 py-1.5 rounded-md border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] text-xs text-[var(--juhe-text)]
                           focus:outline-none focus:ring-1 focus:ring-[var(--juhe-cyan)]'
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.displayName || m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className='p-3 rounded-lg bg-yellow-500/10 text-yellow-600 text-xs'>
            {t('promptReverse.noVisionProvider')}
          </div>
        )}

        {/* Image Upload */}
        <div>
          <label className='text-xs text-[var(--juhe-text-3)] mb-1.5 block'>{t('promptReverse.uploadImage')}</label>
          {!image ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
<div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className='border-2 border-dashed border-[var(--juhe-border)] rounded-lg p-6 flex flex-col items-center
                         justify-center gap-2 cursor-pointer hover:border-[var(--juhe-cyan)]/50 hover:bg-[var(--juhe-surface-2)]/50 transition-colors'
            >
              <Upload className='w-8 h-8 text-[var(--juhe-text-3)]' />
              <span className='text-xs text-[var(--juhe-text-3)]'>{t('promptReverse.dropOrClick')}</span>
              <input ref={fileInputRef} type='file' accept='image/*' onChange={handleFileSelect} className='hidden' />
            </div>
          ) : (
            <div className='relative rounded-lg overflow-hidden border border-[var(--juhe-border)]'>
              <img
                src={image}
                alt='Upload'
                className='w-full aspect-square object-contain bg-[var(--juhe-surface-2)]'
              />
              <button
                type='button'
                onClick={() => {
                  setImage(null)
                  setResult('')
                  setError(null)
                }}
                className='absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white
                           hover:bg-black/70 transition-colors'
              >
                <X className='w-3.5 h-3.5' />
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className='p-3 rounded-lg bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)] text-xs'>{error}</div>
        )}

        {/* Analyze Button */}
        <button
          type='button'
          onClick={handleAnalyze}
          disabled={!image || isAnalyzing || !selectedProviderId}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2
            ${
              isAnalyzing
                ? 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] cursor-not-allowed'
                : !image || !selectedProviderId
                  ? 'bg-[var(--juhe-surface-2)] text-[var(--juhe-text-3)] cursor-not-allowed'
                  : 'bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90'
            }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className='w-4 h-4 animate-spin' />
              {t('promptReverse.analyzing')}
            </>
          ) : (
            <>
              <Wand2 className='w-4 h-4' />
              {t('promptReverse.analyze')}
            </>
          )}
        </button>

        {/* Result */}
        {result && (
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <label className='text-xs text-[var(--juhe-text-3)]'>{t('promptReverse.result')}</label>
              <div className='flex gap-1'>
                <button
                  type='button'
                  onClick={handleCopy}
                  className='p-1.5 rounded-md hover:bg-[var(--juhe-surface-2)] transition-colors'
                  title={t('common.copy')}
                >
                  {copied ? (
                    <Check className='w-3.5 h-3.5 text-green-500' />
                  ) : (
                    <Copy className='w-3.5 h-3.5 text-[var(--juhe-text-2)]' />
                  )}
                </button>
              </div>
            </div>
            <div className='p-3 rounded-lg bg-[var(--juhe-surface-2)] text-sm leading-relaxed max-h-48 overflow-y-auto text-[var(--juhe-text)]'>
              {result}
            </div>
            <button
              type='button'
              onClick={() => onApply(result)}
              className='w-full py-2 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white hover:opacity-90 transition-colors'
            >
              {t('promptReverse.applyToPrompt')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
