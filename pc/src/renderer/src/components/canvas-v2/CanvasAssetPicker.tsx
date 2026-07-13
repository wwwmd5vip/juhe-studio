/**
 * CanvasAssetPicker.tsx — 素材库面板
 * 浏览/搜索已保存素材，插入画布
 */

import { FileAudio, FileVideo, ImageIcon, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasNodeType, Position } from './types'

interface StoredAsset {
  id: string
  nodeId: string
  type: CanvasNodeType
  title: string
  content: string
  bytes?: number
  mimeType?: string
  savedAt: string
}

interface Props {
  open: boolean
  onClose: () => void
  onInsert: (asset: StoredAsset, position: Position) => void
  canvasCenter: Position
}

function loadAssets(): StoredAsset[] {
  try {
    return JSON.parse(localStorage.getItem('canvas-assets') || '[]')
  } catch (error) {
    console.error('Failed to load canvas assets from localStorage:', error)
    return []
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

export function CanvasAssetPicker({ open, onClose, onInsert, canvasCenter }: Props) {
  const { t } = useTranslation()
  const [assets, setAssets] = useState<StoredAsset[]>(loadAssets)
  const [search, setSearch] = useState('')

  // Refresh on open
  const handleOpen = () => {
    setAssets(loadAssets())
    setSearch('')
  }

  if (!open) return null

  const filtered = search ? assets.filter((a) => a.title.toLowerCase().includes(search.toLowerCase())) : assets

  return (
    <div className='fixed inset-0 z-[95] flex items-center justify-center'>
      {/* Invisible backdrop that actually handles open/close */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      {!assets.length && !search && <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <dialog
        ref={(el) => {
          if (el && !el.open) {
            el.showModal()
            handleOpen()
          }
        }}
        onClose={onClose}
        className='pointer-events-auto relative w-[640px] max-h-[560px] rounded-2xl border-0 bg-[#1c1c1e] p-0 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm'
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-5 pb-3'>
          <h3 className='text-base font-semibold text-white'>{t('canvas.toolbar.assets')}</h3>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg p-1 text-white/40 transition hover:bg-white/5 hover:text-white/60'
          >
            <X className='size-4' />
          </button>
        </div>

        {/* Search */}
        <div className='px-5 pb-3'>
          <div className='flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2'>
            <Search className='size-3.5 text-white/30' />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('canvas.assets.searchPlaceholder')}
              className='w-full bg-transparent text-xs text-white outline-none placeholder:text-white/20'
            />
            {search && (
              <button type='button' onClick={() => setSearch('')}>
                <X className='size-3.5 text-white/40' />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className='max-h-[360px] overflow-y-auto px-5 pb-5'>
          {filtered.length === 0 ? (
            <div className='flex flex-col items-center gap-2 py-10 text-white/25'>
              <ImageIcon className='size-8' />
              <p className='text-xs'>
                {assets.length === 0 ? t('canvas.assets.noAssets') : t('canvas.assets.noMatch')}
              </p>
              <p className='text-[11px]'>
                {assets.length === 0 ? t('canvas.assets.saveHint') : t('canvas.assets.tryOtherKeywords')}
              </p>
            </div>
          ) : (
            <div className='grid grid-cols-3 gap-3'>
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  type='button'
                  className='group relative overflow-hidden rounded-xl border border-white/10 bg-white/[.03] p-2 text-left transition hover:border-white/20 hover:bg-white/[.06]'
                  onClick={() => onInsert(asset, canvasCenter)}
                >
                  {/* Preview */}
                  <div className='mb-2 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-black/20'>
                    {asset.type === 'image' ? (
                      <img src={asset.content} alt={asset.title} className='h-full w-full object-cover' />
                    ) : asset.type === 'video' ? (
                      <FileVideo className='size-8 text-white/20' />
                    ) : asset.type === 'audio' ? (
                      <FileAudio className='size-8 text-white/20' />
                    ) : (
                      <ImageIcon className='size-8 text-white/20' />
                    )}
                  </div>
                  {/* Info */}
                  <p className='truncate text-[11px] font-medium text-white/70'>{asset.title}</p>
                  <p className='text-[10px] text-white/30'>
                    {formatDate(asset.savedAt)}
                    {asset.bytes ? ` · ${formatBytes(asset.bytes)}` : ''}
                  </p>
                  {/* Insert overlay */}
                  <div className='absolute inset-0 flex items-center justify-center rounded-xl bg-[#2f80ff]/20 opacity-0 transition group-hover:opacity-100'>
                    <Plus className='size-5 text-white' />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </dialog>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
