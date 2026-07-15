import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ExportToolbarProps {
  projectId: string
}

export function ExportToolbar({ projectId }: ExportToolbarProps) {
  const { t } = useTranslation()
  const [showDialog, setShowDialog] = useState(false)
  const [outputDir, setOutputDir] = useState('')

  const exportMutation = useMutation({
    mutationFn: (dir: string) =>
      (window.api as any).creatorOs.exportDeliverables(projectId, dir),
    onSuccess: (result: { ok: boolean; exportedCount: number; errors: string[] }) => {
      if (result.ok) {
        alert(`Exported ${result.exportedCount} files`)
      } else {
        alert(`Export failed: ${result.errors.join(', ')}`)
      }
      setShowDialog(false)
    }
  })

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-1.5 text-cos-ink-secondary hover:text-cos-ink
                   text-sm font-cos-body transition-colors"
      >
        <Download className="w-4 h-4" />
        {t('creator-os.export')}
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-cos-surface rounded-cos-lg shadow-cos-overlay p-6 w-96">
            <h2 className="font-cos-heading text-lg text-cos-ink mb-4">
              {t('creator-os.export-dialog-title')}
            </h2>
            <p className="text-sm text-cos-ink-secondary mb-4">
              {t('creator-os.export-dialog-desc')}
            </p>
            <div className="flex gap-2 mb-4">
              <input
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder={t('creator-os.export-path-placeholder')}
                className="flex-1 border border-cos-border rounded-cos-md px-3 py-2
                           text-sm text-cos-ink font-cos-body focus:outline-none
                           focus:border-cos-accent"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDialog(false)}
                className="text-cos-ink-secondary hover:text-cos-ink text-sm"
              >
                {t('creator-os.export-cancel')}
              </button>
              <button
                onClick={() => {
                  if (outputDir.trim()) {
                    exportMutation.mutate(outputDir.trim())
                  }
                }}
                disabled={!outputDir.trim() || exportMutation.isPending}
                className="bg-cos-accent hover:bg-cos-accent-hover text-white px-4 py-2
                           rounded-cos-md text-sm disabled:opacity-50"
              >
                {exportMutation.isPending
                  ? t('creator-os.export-exporting')
                  : t('creator-os.export-confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
