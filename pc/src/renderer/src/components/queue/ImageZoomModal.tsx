import { X } from 'lucide-react'

export function ImageZoomModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level
    // biome-ignore lint/a11y/noStaticElementInteractions: interactive element handled via event propagation
    <div className='fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4' onClick={onClose}>
      <div className='relative max-w-[90vw] max-h-[90vh]'>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard interaction handled at parent level */}
        <img
          src={imageUrl}
          alt='Zoomed'
          className='max-w-full max-h-[90vh] object-contain rounded-lg'
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type='button'
          onClick={onClose}
          className='absolute -top-3 -right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors'
        >
          <X className='w-5 h-5' />
        </button>
      </div>
    </div>
  )
}
