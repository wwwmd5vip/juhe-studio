import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface AssetPanelProps {
  projectId: string
  assets: Array<{
    id: string
    filePath: string
    kind: string
    mimeType: string
    createdAt: string
  }>
}

export function AssetPanel({ projectId, assets }: AssetPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLDivElement>(null)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['creator-os', 'assets', projectId] })
  }, [queryClient, projectId])

  const importFile = useCallback(
    async (filePath: string) => {
      try {
        await (window.api as any).creatorOs.importAsset(projectId, filePath)
        invalidate()
      } catch (err) {
        console.error('Import failed:', err)
      }
    },
    [projectId, invalidate]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files) return
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        // In Electron, file.path gives the absolute path
        const path = (file as any).path
        if (path) {
          await importFile(path)
        }
      }
      e.target.value = ''
    },
    [importFile]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const files = e.dataTransfer.files
      for (let i = 0; i < files.length; i++) {
        const path = (files[i] as any).path
        if (path) {
          await importFile(path)
        }
      }
    },
    [importFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const sourceAssets = assets.filter((a) => a.kind === 'source')

  return (
    <div className="w-60 border-r border-cos-border bg-cos-surface flex flex-col shrink-0">
      <div className="p-3 border-b border-cos-border">
        <h3 className="font-cos-heading text-xs text-cos-ink-secondary uppercase tracking-wide">
          {t('creator-os.asset-panel')}
          {sourceAssets.length > 0 && (
            <span className="ml-1 text-cos-ink-muted">({sourceAssets.length})</span>
          )}
        </h3>
      </div>

      {/* Drop zone */}
      <div
        ref={uploadRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="m-3 border border-dashed border-cos-border rounded-cos-md
                   p-4 text-center cursor-pointer hover:border-cos-accent
                   hover:bg-cos-surface-hover transition-colors"
      >
        <Upload className="w-5 h-5 mx-auto text-cos-ink-muted mb-1" />
        <p className="text-xs text-cos-ink-muted">{t('creator-os.import-asset')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {sourceAssets.length === 0 ? (
          <p className="text-xs text-cos-ink-muted text-center mt-8">
            Drag images here
          </p>
        ) : (
          <div className="space-y-2">
            {sourceAssets.map((a) => (
              <div
                key={a.id}
                className="bg-cos-bg-alt rounded-cos-sm overflow-hidden"
              >
                <img
                  src={`juhe-image://${a.filePath}`}
                  alt=""
                  className="w-full h-24 object-cover"
                  onError={(e) => {
                    // Fallback: show filename
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
                <p className="text-[10px] text-cos-ink-muted p-1.5 truncate">
                  {a.filePath.split('/').pop()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
