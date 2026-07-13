/**
 * CanvasNodeSplitDialog.tsx - 图片切分弹窗
 * 将图片按行列网格切分为 N 个子节点
 */

import { Grid2X2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanvasImageSplitParams } from './types'

interface Props {
  dataUrl: string
  open: boolean
  onClose: () => void
  onConfirm: (params: CanvasImageSplitParams) => void
}

export function CanvasNodeSplitDialog({ dataUrl, open, onClose, onConfirm }: Props) {
  const { t } = useTranslation()
  const [rows, setRows] = useState(2)
  const [columns, setColumns] = useState(2)

  useEffect(() => {
    if (open) {
      setRows(2)
      setColumns(2)
    }
  }, [open])

  const handleRowsChange = useCallback((val: number) => {
    setRows(Math.max(1, Math.min(12, Math.round(val))))
  }, [])

  const handleColumnsChange = useCallback((val: number) => {
    setColumns(Math.max(1, Math.min(12, Math.round(val))))
  }, [])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-[90] flex items-center justify-center'>
      {/* backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />

      <div className='relative flex w-[780px] gap-6 rounded-2xl bg-[#1c1c1e] p-6 shadow-2xl'>
        {/* Left: preview with grid */}
        <div className='flex w-[360px] shrink-0 flex-col gap-3'>
          <div className='relative overflow-hidden rounded-xl bg-black/30' style={{ maxHeight: 340 }}>
            <img
              src={dataUrl}
              alt={t('canvas.splitDialog.preview')}
              className='block w-full object-contain'
              style={{ maxHeight: 340 }}
            />
            {/* Grid overlay */}
            <div className='absolute inset-0'>
              {Array.from({ length: columns - 1 }).map((_, i) => (
                <div
                  key={`col-${// biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
i}`}
                  className='absolute top-0 h-full border-l border-white/80'
                  style={{
                    left: `${((i + 1) / columns) * 100}%`,
                    boxShadow: '0 0 1px rgba(0,0,0,0.5)'
                  }}
                />
              ))}
              {Array.from({ length: rows - 1 }).map((_, i) => (
                <div
                  key={`row-${// biome-ignore lint/suspicious/noArrayIndexKey: static array, never reordered
i}`}
                  className='absolute left-0 w-full border-t border-white/80'
                  style={{
                    top: `${((i + 1) / rows) * 100}%`,
                    boxShadow: '0 0 1px rgba(0,0,0,0.5)'
                  }}
                />
              ))}
            </div>
          </div>
          <p className='text-center text-xs text-white/40'>{t('canvas.splitDialog.previewEffect')}</p>
        </div>

        {/* Right: controls */}
        <div className='flex flex-1 flex-col gap-5'>
          <h3 className='text-base font-semibold text-white'>{t('canvas.splitDialog.title')}</h3>

          {/* 行数 */}
          <label className='flex flex-col gap-2'>
            <span className='text-xs text-white/50'>{t('canvas.splitDialog.rows')}</span>
            <input
              type='number'
              min={1}
              max={12}
              value={rows}
              onChange={(e) => handleRowsChange(Number(e.target.value))}
              className='w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-[#2f80ff]'
            />
          </label>

          {/* 列数 */}
          <label className='flex flex-col gap-2'>
            <span className='text-xs text-white/50'>{t('canvas.splitDialog.columns')}</span>
            <input
              type='number'
              min={1}
              max={12}
              value={columns}
              onChange={(e) => handleColumnsChange(Number(e.target.value))}
              className='w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-[#2f80ff]'
            />
          </label>

          {/* 摘要 */}
          <div className='rounded-xl border border-white/10 p-3'>
            <p className='text-xs text-white/40'>
              {t('canvas.splitDialog.willGenerate', { count: rows * columns })}
              {rows * columns > 1 ? `（${columns} × ${rows} ${t('canvas.splitDialog.grid')}）` : ''}
            </p>
          </div>

          {/* 按钮 */}
          <div className='flex gap-2 pt-1'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/5'
            >
              {t('canvas.splitDialog.cancel')}
            </button>
            <button
              type='button'
              onClick={() => onConfirm({ rows, columns })}
              className='flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2f80ff] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#2f80ff]/90'
            >
              <Grid2X2 className='size-4' />
              {t('canvas.splitDialog.generate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 在 canvas 上将 dataUrl 按 rows×columns 切分，返回切块 dataUrl 数组
 */
export function splitDataUrl(dataUrl: string, params: CanvasImageSplitParams): Promise<string[]> {
  const { rows, columns } = params
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const pieceW = img.naturalWidth / columns
      const pieceH = img.naturalHeight / rows
      const canvas = document.createElement('canvas')
      canvas.width = pieceW
      canvas.height = pieceH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'))
        return
      }

      const pieces: string[] = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          ctx.clearRect(0, 0, pieceW, pieceH)
          ctx.drawImage(img, c * pieceW, r * pieceH, pieceW, pieceH, 0, 0, pieceW, pieceH)
          pieces.push(canvas.toDataURL('image/png'))
        }
      }
      resolve(pieces)
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUrl
  })
}
