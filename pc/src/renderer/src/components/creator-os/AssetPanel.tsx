import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, Trash2 } from 'lucide-react'
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

  const deleteAsset = useCallback(
    async (assetId: string) => {
      try {
        await (window.api as any).creatorOs.deleteAsset(assetId)
        invalidate()
      } catch (err) {
        console.error('Delete failed:', err)
      }
    },
    [invalidate]
  )

  const getFilePath = useCallback((file: File): string | null => {
    const fileApi = (window.api as unknown as { file: { getPathForFile: (f: File) => string | null } }).file
    return fileApi.getPathForFile(file)
  }, [])

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files) return
      for (let i = 0; i < files.length; i++) {
        const path = getFilePath(files[i])
        if (path) await importFile(path)
      }
      e.target.value = ''
    },
    [importFile, getFilePath]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const path = getFilePath(e.dataTransfer.files[i])
        if (path) await importFile(path)
      }
    },
    [importFile, getFilePath]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const sourceAssets = assets.filter((a) => a.kind === 'source')

  return (
    <div className="w-60 border-r border-cos-border bg-cos-surface flex flex-col shrink-0">
      {/* Header */}
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
            {t('creator-os.drag-images-hint')}
          </p>
        ) : (
          <div className="space-y-2">
            {sourceAssets.map((a) => (
              <div
                key={a.id}
                className="bg-cos-bg-alt rounded-cos-sm overflow-hidden group relative"
              >
                <img
                  src={`juhe-image://${a.filePath}`}
                  alt=""
                  className="w-full h-24 object-cover"
                  onError={(e: any) => {
                    e.target.style.display = 'none'
                  }}
                />
                {/* Delete button on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteAsset(a.id)
                  }}
                  className="absolute top-1 right-1 bg-cos-ink/60 hover:bg-cos-error
                             text-white rounded-cos-sm p-1 opacity-0
                             group-hover:opacity-100 transition-opacity"
                  title={t('creator-os.delete-asset')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
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
