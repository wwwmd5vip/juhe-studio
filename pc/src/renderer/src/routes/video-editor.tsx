import { createFileRoute } from '@tanstack/react-router'
import { VideoEditor } from '@/components/video/VideoEditor'

export const Route = createFileRoute('/video-editor')({
  component: VideoEditorPage
})

function VideoEditorPage() {
  return (
    <div className='h-[calc(100vh-3rem)]' style={{ background: 'var(--juhe-void)' }}>
      <VideoEditor />
    </div>
  )
}
