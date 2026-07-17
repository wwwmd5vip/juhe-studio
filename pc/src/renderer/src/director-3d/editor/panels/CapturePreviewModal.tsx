import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface CapturePreviewModalProps {
  isOpen: boolean
  captures: Array<{ dataUrl: string; fileName: string; error?: string }>
  onClose: () => void
  onDownload?: (dataUrl: string, fileName: string) => void
}

export function CapturePreviewModal({ isOpen, captures, onClose, onDownload }: CapturePreviewModalProps) {
  const { t } = useTranslation()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || captures.length === 0) return null

  return (
    <div
      className="director-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div
        className="director-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--director-surface, #1f1f1f)',
          borderRadius: 8,
          padding: 16,
          maxWidth: '80vw',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: 'var(--director-ink, #fff)' }}>{t('director3d.capture.previewTitle')}</h3>
          <button onClick={onClose} style={{ color: 'var(--director-ink, #fff)' }}>
            {t('director3d.capture.close')}
          </button>
        </div>
        {captures.map((capture, index) => (
          <div key={index} style={{ marginBottom: 16 }}>
            {capture.error && (
              <p style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 4 }}>{capture.error}</p>
            )}
            <img
              src={capture.dataUrl}
              alt={capture.fileName}
              style={{ maxWidth: '100%', maxHeight: 300, display: 'block', marginBottom: 8 }}
            />
            <button
              onClick={() => {
                const link = document.createElement('a')
                link.href = capture.dataUrl
                link.download = capture.fileName
                link.click()
                onDownload?.(capture.dataUrl, capture.fileName)
              }}
              style={{
                padding: '6px 12px',
                background: 'var(--director-accent, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              {t('director3d.capture.download')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
