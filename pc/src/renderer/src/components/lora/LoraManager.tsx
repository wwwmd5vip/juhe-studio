import { ExternalLink, Plus, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface LoraModel {
  id: string
  name: string
  fileName: string
  previewImage?: string
  weight: number
  tags: string[]
  source?: string
  size: number
  importedAt: string
}

const DEMO_LORAS: LoraModel[] = [
  {
    id: 'lora-1',
    name: 'Anime Style',
    fileName: 'anime_style_v2.safetensors',
    weight: 0.8,
    tags: ['anime', 'style'],
    size: 72 * 1024 * 1024,
    importedAt: '2026-05-01'
  },
  {
    id: 'lora-2',
    name: 'Cyberpunk Neon',
    fileName: 'cyberpunk_neon.safetensors',
    weight: 0.6,
    tags: ['cyberpunk', 'neon', 'sci-fi'],
    size: 144 * 1024 * 1024,
    importedAt: '2026-05-15'
  }
]

export default function LoraManager() {
  const { t } = useTranslation()
  const [loras, setLoras] = useState<LoraModel[]>(DEMO_LORAS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.safetensors')) continue

      const newLora: LoraModel = {
        id: `lora-${Date.now()}`,
        name: file.name.replace('.safetensors', '').replace(/_/g, ' '),
        fileName: file.name,
        weight: 0.8,
        tags: [],
        size: file.size,
        importedAt: new Date().toISOString().split('T')[0]
      }
      setLoras((prev) => [...prev, newLora])
    }
  }

  const handleDelete = (id: string) => {
    setLoras((prev) => prev.filter((l) => l.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const updateWeight = (id: string, weight: number) => {
    setLoras((prev) => prev.map((l) => (l.id === id ? { ...l, weight } : l)))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const selected = loras.find((l) => l.id === selectedId)

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-[var(--juhe-border)]'>
        <h2 className='text-sm font-semibold'>{t('lora.title')}</h2>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => fileInputRef.current?.click()}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-[var(--juhe-cyan)]-foreground rounded-md hover:bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)]/90 transition-colors'
          >
            <Upload className='w-3.5 h-3.5' />
            {t('lora.import')}
          </button>
          <button
            type='button'
            onClick={() => window.open('https://civitai.com', '_blank')}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--juhe-surface-2)] rounded-md hover:bg-[var(--juhe-surface-2)]/80 transition-colors'
          >
            <ExternalLink className='w-3.5 h-3.5' />
            Civitai
          </button>
        </div>
        <input
          ref={fileInputRef}
          type='file'
          accept='.safetensors'
          multiple
          onChange={handleImport}
          className='hidden'
        />
      </div>

      {/* Content */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Lora List */}
        <div className='w-1/2 border-r border-[var(--juhe-border)] overflow-y-auto'>
          {loras.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-full text-[var(--juhe-text-3)]'>
              <Upload className='w-8 h-8 mb-2 opacity-20' />
              <p className='text-xs'>{t('lora.noModels')}</p>
              <p className='text-[10px] mt-1'>{t('lora.importHint')}</p>
            </div>
          ) : (
            <div className='divide-y divide-border'>
              {loras.map((lora) => (
                <button
                  type='button'
                  key={lora.id}
                  onClick={() => setSelectedId(lora.id)}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${
                    selectedId === lora.id ? 'bg-[var(--juhe-cyan)]/5' : 'hover:bg-[var(--juhe-surface-2)]/50'
                  }`}
                >
                  <div className='flex items-center justify-between'>
                    <span className='text-xs font-medium'>{lora.name}</span>
                    <span className='text-[10px] text-[var(--juhe-text-3)]'>{formatSize(lora.size)}</span>
                  </div>
                  <div className='flex items-center gap-2 mt-1'>
                    <span className='text-[10px] text-[var(--juhe-text-3)]'>{lora.fileName}</span>
                    <span className='text-[10px] px-1.5 py-0.5 bg-[var(--juhe-surface-2)] rounded-full'>
                      {t('lora.details.weight')}: {lora.weight}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className='w-1/2 overflow-y-auto p-4'>
          {selected ? (
            <div className='space-y-4'>
              {/* Preview */}
              <div className='aspect-square rounded-lg bg-[var(--juhe-surface-2)] flex items-center justify-center'>
                {selected.previewImage ? (
                  <img
                    src={selected.previewImage}
                    alt={selected.name}
                    className='w-full h-full object-cover rounded-lg'
                  />
                ) : (
                  <div className='text-center text-[var(--juhe-text-3)]'>
                    <SlidersHorizontal className='w-8 h-8 mx-auto mb-1 opacity-20' />
                    <span className='text-[10px]'>{t('lora.details.noPreview')}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className='space-y-2'>
                <div>
                  <label className='text-[10px] text-[var(--juhe-text-3)]'>{t('lora.details.name')}</label>
                  <div className='text-xs font-medium'>{selected.name}</div>
                </div>
                <div>
                  <label className='text-[10px] text-[var(--juhe-text-3)]'>{t('lora.details.filename')}</label>
                  <div className='text-xs'>{selected.fileName}</div>
                </div>
                <div>
                  <label className='text-[10px] text-[var(--juhe-text-3)]'>{t('lora.details.size')}</label>
                  <div className='text-xs'>{formatSize(selected.size)}</div>
                </div>
                <div>
                  <label className='text-[10px] text-[var(--juhe-text-3)]'>{t('lora.details.importTime')}</label>
                  <div className='text-xs'>{selected.importedAt}</div>
                </div>
              </div>

              {/* Weight Slider */}
              <div>
                <label className='text-xs font-medium'>
                  {t('lora.details.weight')}: {selected.weight.toFixed(2)}
                </label>
                <input
                  type='range'
                  min={0}
                  max={2}
                  step={0.05}
                  value={selected.weight}
                  onChange={(e) => updateWeight(selected.id, Number(e.target.value))}
                  className='w-full mt-1'
                />
                <div className='flex justify-between text-[10px] text-[var(--juhe-text-3)]'>
                  <span>0</span>
                  <span>1</span>
                  <span>2</span>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className='text-xs font-medium'>{t('lora.details.tags')}</label>
                <div className='flex flex-wrap gap-1 mt-1'>
                  {selected.tags.map((tag) => (
                    <span key={tag} className='text-[10px] px-2 py-0.5 bg-[var(--juhe-surface-2)] rounded-full'>
                      {tag}
                    </span>
                  ))}
                  <button
                    type='button'
                    className='text-[10px] px-2 py-0.5 border border-dashed border-[var(--juhe-border)] rounded-full hover:border-foreground/30 transition-colors'
                  >
                    <Plus className='w-2.5 h-2.5' />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className='flex gap-2 pt-2'>
                <button
                  type='button'
                  onClick={() => handleDelete(selected.id)}
                  className='flex-1 flex items-center justify-center gap-1 py-2 text-xs bg-[var(--juhe-magenta)]/10 text-[var(--juhe-magenta)] rounded-md hover:bg-[var(--juhe-magenta)]/20 transition-colors'
                >
                  <Trash2 className='w-3.5 h-3.5' />
                  {t('lora.delete')}
                </button>
              </div>
            </div>
          ) : (
            <div className='flex items-center justify-center h-full text-[var(--juhe-text-3)]'>
              <span className='text-xs'>{t('lora.selectToView')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
