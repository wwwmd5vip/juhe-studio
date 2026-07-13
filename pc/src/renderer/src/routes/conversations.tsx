/**
 * ConversationView.tsx — 对话式迭代优化视图
 * 来源灵感：Gemini Webapp 对话式生图、Shoplive 图片精修流程
 * 
 * 将生成历史组织为对话线程，支持：
 * - 查看每次生成的 prompt + 图片
 * - 基于任意图片继续精修（设置参考图/变体）
 * - 复制 prompt 重新生成
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Copy, Maximize2, MessageSquare, RefreshCw, Wand2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useGenerationStore } from '@/stores/generation'

export const Route = createFileRoute('/conversations')({
  component: ConversationView
})

function ConversationView() {
  const navigate = useNavigate({ from: '/conversations' })
  const tasks = useGenerationStore((s) => s.tasks)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Group outputs into conversation threads
  const threads = useMemo(() => {
    type ThreadItem = {
      id: string
      prompt: string
      images: Array<{ url: string; outputId: string; taskId: string }>
      createdAt: number
      providerId: string
      model: string
    }
    const items: ThreadItem[] = []

    const sortedTasks = [...tasks]
      .filter((t) => t.outputs && t.outputs.length > 0)
      .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt))

    for (const task of sortedTasks) {
      const images = task.outputs
        .map((o: { url?: string; base64?: string; mediaType?: string; id: string }) => {
          const url = o.url || (o.base64 && o.mediaType ? `data:${o.mediaType};base64,${o.base64}` : null)
          return url ? { url, outputId: o.id, taskId: task.id } : null
        })
        .filter(Boolean) as Array<{ url: string; outputId: string; taskId: string }>

      if (images.length === 0) continue

      items.push({
        id: task.id,
        prompt: task.params.prompt || '(empty)',
        images,
        createdAt: task.completedAt || task.createdAt,
        providerId: task.params.providerId || 'unknown',
        model: task.params.model || 'unknown',
      })
    }

    return items.slice(0, 50)
  }, [tasks])

  const handleContinueRefining = (imageUrl: string) => {
    // Navigate to generate with this image as reference
    navigate({ to: '/generate', search: { ref: imageUrl } })
  }

  const handleRegenerate = (prompt: string) => {
    navigate({ to: '/generate', search: { prompt } })
  }

  return (
    <div className='h-[calc(100vh-3rem)] flex flex-col' style={{ background: 'var(--juhe-void)' }}>
      {/* Header */}
      <div className='px-6 py-4 border-b border-[var(--juhe-border)]'>
        <div className='flex items-center gap-2'>
          <MessageSquare className='w-5 h-5 text-[var(--juhe-cyan)]' />
          <h1 className='text-lg font-bold text-[var(--juhe-text)]'>对话精修</h1>
          <span className='text-[10px] px-2 py-0.5 rounded-full bg-[var(--juhe-cyan)]/15 text-[var(--juhe-cyan)]'>
            {threads.length} 个对话线程
          </span>
        </div>
        <p className='text-xs text-[var(--juhe-text-3)] mt-1'>
          基于历史生成结果进行迭代精修，任意图片都可作为参考继续优化
        </p>
      </div>

      {/* Thread list */}
      <div className='flex-1 overflow-y-auto px-6 py-4 space-y-6'>
        {threads.length === 0 && (
          <div className='flex flex-col items-center justify-center h-full text-sm text-[var(--juhe-text-3)] gap-3'>
            <MessageSquare className='w-10 h-10 opacity-20' />
            <span>暂无生成记录，先到创作中心生成一些图片吧</span>
          </div>
        )}
        {threads.map((thread) => (
          <div key={thread.id} className='rounded-2xl border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] overflow-hidden'>
            {/* Prompt header */}
            <div className='px-4 py-3 border-b border-[var(--juhe-border)] bg-[var(--juhe-surface)]/30'>
              <div className='flex items-center justify-between gap-3'>
                <p className='text-xs text-[var(--juhe-text)] flex-1 line-clamp-2'>{thread.prompt}</p>
                <div className='flex items-center gap-1.5 shrink-0'>
                  <button
                    type='button'
                    onClick={() => handleRegenerate(thread.prompt)}
                    className='p-1.5 rounded-lg hover:bg-[var(--juhe-cyan)]/10 text-[var(--juhe-text-3)] hover:text-[var(--juhe-cyan)] transition-colors'
                    title='重新生成'
                  >
                    <RefreshCw className='w-3.5 h-3.5' />
                  </button>
                  <button
                    type='button'
                    onClick={() => navigator.clipboard.writeText(thread.prompt)}
                    className='p-1.5 rounded-lg hover:bg-[var(--juhe-surface)] text-[var(--juhe-text-3)] transition-colors'
                    title='复制 prompt'
                  >
                    <Copy className='w-3.5 h-3.5' />
                  </button>
                </div>
              </div>
              <div className='flex items-center gap-2 mt-1.5 text-[9px] text-[var(--juhe-text-3)]'>
                <span>{thread.providerId}</span>
                <span>·</span>
                <span>{thread.model}</span>
              </div>
            </div>

            {/* Images grid */}
            <div className='p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5'>
              {thread.images.map((img) => (
                <div key={img.outputId} className='group relative rounded-xl overflow-hidden bg-[var(--juhe-surface)] border border-[var(--juhe-border)]'>
                  <img
                    src={img.url}
                    alt=''
                    className='w-full aspect-square object-cover cursor-pointer'
                    onClick={() => setSelectedImage(img.url)}
                  />
                  {/* Hover actions */}
                  <div className='absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'>
                    <button
                      type='button'
                      onClick={(e) => { e.stopPropagation(); handleContinueRefining(img.url) }}
                      className='p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors'
                      title='继续精修'
                    >
                      <Wand2 className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      onClick={(e) => { e.stopPropagation(); setSelectedImage(img.url) }}
                      className='p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors'
                      title='查看大图'
                    >
                      <Maximize2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-8' onClick={() => setSelectedImage(null)}>
          <div className='absolute inset-0 bg-black/80 backdrop-blur-sm' />
          <img
            src={selectedImage}
            alt=''
            className='relative max-w-full max-h-full object-contain rounded-xl shadow-2xl'
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type='button'
            onClick={() => setSelectedImage(null)}
            className='absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white'
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
