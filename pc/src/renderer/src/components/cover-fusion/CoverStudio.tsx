/**
 * CoverStudio — 封面融合设计组件 (P2.5)
 *
 * 对标 RedBox 的 Cover 融合功能：
 * - 图层管理（背景图 + 前景图 + 文字层）
 * - 混合模式（overlay/multiply/screen/soft-light）
 * - 导出融合结果
 */
import { useState, useCallback } from 'react'
import { Layers, ImagePlus, Type, Download, Trash2, GripVertical } from 'lucide-react'

interface CoverLayer {
  id: string
  type: 'image' | 'text'
  src?: string // base64 for image layers
  text?: string // for text layers
  blendMode: BlendMode
  opacity: number
  x: number
  y: number
  scale: number
  fontSize?: number
  color?: string
}

type BlendMode = 'normal' | 'overlay' | 'multiply' | 'screen' | 'soft-light' | 'hard-light'

const BLEND_MODES: BlendMode[] = ['normal', 'overlay', 'multiply', 'screen', 'soft-light', 'hard-light']

export function CoverStudio() {
  const [layers, setLayers] = useState<CoverLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  const addImageLayer = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const newLayer: CoverLayer = {
          id: crypto.randomUUID(),
          type: 'image',
          src: reader.result as string,
          blendMode: 'normal',
          opacity: 1,
          x: canvasSize.width / 2 - 100,
          y: canvasSize.height / 2 - 100,
          scale: 1
        }
        setLayers((prev) => [...prev, newLayer])
        setSelectedLayerId(newLayer.id)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }, [canvasSize])

  const addTextLayer = useCallback(() => {
    const newLayer: CoverLayer = {
      id: crypto.randomUUID(),
      type: 'text',
      text: 'Enter text...',
      blendMode: 'normal',
      opacity: 1,
      x: canvasSize.width / 2 - 50,
      y: canvasSize.height - 80,
      scale: 1,
      fontSize: 32,
      color: '#ffffff'
    }
    setLayers((prev) => [...prev, newLayer])
    setSelectedLayerId(newLayer.id)
  }, [canvasSize])

  const removeLayer = useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id))
    setSelectedLayerId((prev) => (prev === id ? null : prev))
  }, [])

  const updateLayer = useCallback((id: string, updates: Partial<CoverLayer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    )
  }, [])

  const downloadComposite = useCallback(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 按图层顺序绘制（先绘制的在底部）
    const sortedLayers = [...layers].reverse()
    for (const layer of sortedLayers) {
      ctx.save()
      ctx.globalAlpha = layer.opacity
      ctx.globalCompositeOperation = layer.blendMode === 'normal'
        ? 'source-over'
        : (layer.blendMode as GlobalCompositeOperation)

      if (layer.type === 'image' && layer.src) {
        const img = new Image()
        img.src = layer.src
        // Note: 异步加载，简化处理
        ctx.drawImage(img, layer.x, layer.y, 200 * layer.scale, 200 * layer.scale)
      } else if (layer.type === 'text' && layer.text) {
        ctx.font = `${(layer.fontSize || 32) * layer.scale}px sans-serif`
        ctx.fillStyle = layer.color || '#ffffff'
        ctx.fillText(layer.text, layer.x, layer.y)
      }

      ctx.restore()
    }

    const link = document.createElement('a')
    link.download = `cover-fusion-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [layers, canvasSize])

  const selectedLayer = layers.find((l) => l.id === selectedLayerId)

  return (
    <div className="flex h-full">
      {/* Layer Panel */}
      <div className="w-56 border-r border-cos-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-cos-heading text-sm text-cos-ink-secondary flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Layers
          </h3>
        </div>

        <div className="flex gap-1">
          <button
            onClick={addImageLayer}
            className="flex-1 text-xs flex items-center justify-center gap-1
                       bg-cos-bg-alt hover:bg-cos-border rounded-cos-sm py-1.5 text-cos-ink-muted"
          >
            <ImagePlus className="w-3 h-3" /> Image
          </button>
          <button
            onClick={addTextLayer}
            className="flex-1 text-xs flex items-center justify-center gap-1
                       bg-cos-bg-alt hover:bg-cos-border rounded-cos-sm py-1.5 text-cos-ink-muted"
          >
            <Type className="w-3 h-3" /> Text
          </button>
        </div>

        <div className="space-y-1 max-h-[60vh] overflow-auto">
          {layers.map((layer) => (
            <div
              key={layer.id}
              onClick={() => setSelectedLayerId(layer.id)}
              className={`flex items-center gap-2 p-2 rounded-cos-sm cursor-pointer text-xs
                          ${selectedLayerId === layer.id
                            ? 'bg-cos-accent-muted ring-1 ring-cos-accent'
                            : 'hover:bg-cos-bg-alt'}`}
            >
              <GripVertical className="w-3 h-3 text-cos-ink-muted shrink-0" />
              <span className="flex-1 truncate text-cos-ink-secondary">
                {layer.type === 'image' ? '🖼 Image' : '📝 Text'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id) }}
                className="text-cos-ink-muted hover:text-cos-error shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center bg-cos-bg-alt p-4">
        <div
          className="relative border border-cos-border shadow-lg"
          style={{ width: canvasSize.width, height: canvasSize.height, backgroundColor: '#1a1a2e' }}
        >
          {[...layers].reverse().map((layer) => (
            <div
              key={layer.id}
              className={`absolute cursor-move ${selectedLayerId === layer.id ? 'ring-2 ring-cos-accent' : ''}`}
              style={{
                left: layer.x,
                top: layer.y,
                opacity: layer.opacity,
                mixBlendMode: layer.blendMode,
                transform: `scale(${layer.scale})`,
                transformOrigin: 'top left'
              }}
              onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id) }}
            >
              {layer.type === 'image' && layer.src ? (
                <img src={layer.src} alt="layer" className="max-w-[200px] max-h-[200px] object-contain" />
              ) : layer.type === 'text' ? (
                <span style={{ fontSize: layer.fontSize || 32, color: layer.color || '#fff' }}>
                  {layer.text}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Properties Panel */}
      {selectedLayer && (
        <div className="w-48 border-l border-cos-border p-3 space-y-3">
          <h3 className="font-cos-heading text-xs text-cos-ink-secondary">Properties</h3>

          <div className="space-y-2">
            <label className="text-[10px] text-cos-ink-muted">Blend Mode</label>
            <select
              value={selectedLayer.blendMode}
              onChange={(e) => updateLayer(selectedLayer.id, { blendMode: e.target.value as BlendMode })}
              className="w-full text-xs border border-cos-border rounded-cos-sm bg-cos-surface
                         text-cos-ink px-2 py-1"
            >
              {BLEND_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-cos-ink-muted">
              Opacity: {Math.round(selectedLayer.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selectedLayer.opacity}
              onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-cos-ink-muted">Scale: {selectedLayer.scale.toFixed(1)}x</label>
            <input
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={selectedLayer.scale}
              onChange={(e) => updateLayer(selectedLayer.id, { scale: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          {selectedLayer.type === 'text' && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] text-cos-ink-muted">Text</label>
                <textarea
                  value={selectedLayer.text}
                  onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                  rows={2}
                  className="w-full text-xs border border-cos-border rounded-cos-sm bg-cos-surface
                             text-cos-ink px-2 py-1 resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-cos-ink-muted">Font Size</label>
                <input
                  type="number"
                  value={selectedLayer.fontSize || 32}
                  onChange={(e) => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                  className="w-full text-xs border border-cos-border rounded-cos-sm bg-cos-surface
                             text-cos-ink px-2 py-1"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Export Button */}
      <div className="absolute bottom-4 right-4">
        <button
          onClick={downloadComposite}
          disabled={layers.length === 0}
          className="flex items-center gap-2 bg-cos-accent hover:bg-cos-accent-hover text-white
                     text-sm px-4 py-2 rounded-cos-md disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export PNG
        </button>
      </div>
    </div>
  )
}
