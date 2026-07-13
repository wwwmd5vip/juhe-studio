import { ImageIcon, Maximize2, Rocket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'
import { useGenerationStore } from '@/stores/generation'
import { StepCard } from '../StepCard'

interface ResultStepCardProps {
  step: import('@shared/ecommerce-workflow/types').WorkflowTemplateStep
  stepState: import('@shared/ecommerce-workflow/types').WorkflowStepState
  workflowId: string
}

export function ResultStepCard({ step, stepState }: ResultStepCardProps) {
  const { t } = useTranslation()
  const { currentWorkflow, isLoading, submitModules } = useEcommerceWorkflowStore()
  const generationTasks = useGenerationStore((s) => s.tasks)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const modules = currentWorkflow?.modules ?? []
  const enabledCount = modules.filter((m) => m.enabled).length

  // 获取已提交任务的结果图片
  const submittedResults = modules
    .filter((m) => m.submittedTaskId)
    .map((m) => {
      const task = generationTasks.find((g) => g.id === m.submittedTaskId)
      const images = task?.outputs?.map((o) => o.url || (o.base64 && o.mediaType ? `data:${o.mediaType};base64,${o.base64}` : null)).filter(Boolean) ?? []
      return { moduleId: m.moduleId, moduleName: m.moduleName, taskId: m.submittedTaskId, images: images as string[], status: task?.status || 'unknown' }
    })
  const allImages = submittedResults.flatMap((r) => r.images)

  const handleSubmit = async () => {
    await submitModules(currentWorkflow?.context.productImage, 'fusion')
  }

  return (
    <StepCard step={step} stepState={stepState}>
      <div className='flex items-center justify-between p-3 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)]'>
        <div>
          <div className='text-sm font-medium'>{t('ecommerceWorkflow.readyToSubmit')}</div>
          <div className='text-xs text-[var(--juhe-text-3)]'>
            {t('ecommerceWorkflow.enabledModulesCount', { count: enabledCount })}
          </div>
        </div>
        <button
          type='button'
          onClick={handleSubmit}
          disabled={enabledCount === 0 || isLoading}
          className='flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-gradient-to-br from-[var(--juhe-cyan)] to-[var(--juhe-violet)] text-white disabled:opacity-50'
        >
          <Rocket className='w-4 h-4' />
          {t('ecommerceWorkflow.submit')}
        </button>
      </div>

      {/* 已提交任务结果展示 */}
      {submittedResults.length > 0 && (
        <div className='space-y-3 mt-4'>
          <div className='flex items-center justify-between'>
            <h4 className='text-sm font-medium flex items-center gap-1.5'>
              <ImageIcon className='w-3.5 h-3.5 text-[var(--juhe-cyan)]' />
              生成结果 ({allImages.length} 张)
            </h4>
          </div>

          {allImages.length > 0 ? (
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5'>
              {submittedResults.map((result) =>
                result.images.map((url, idx) => (
                  <div
                    key={`${result.moduleId}-${idx}`}
                    className='relative group rounded-lg overflow-hidden border border-[var(--juhe-border)] aspect-square cursor-pointer'
                    onClick={() => setLightboxUrl(url)}
                  >
                    <img src={url} alt='' className='w-full h-full object-cover' />
                    <div className='absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center'>
                      <Maximize2 className='w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity' />
                    </div>
                    <div className='absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent'>
                      <span className='text-[9px] text-white/80 truncate block'>{result.moduleName}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className='space-y-1.5'>
              {submittedResults.map((r) => (
                <div key={r.moduleId} className='flex items-center justify-between text-xs p-2.5 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)]'>
                  <span className='text-[var(--juhe-text-2)]'>{r.moduleName}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    r.status === 'completed' ? 'bg-green-500/15 text-green-400' :
                    r.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                    'bg-[var(--juhe-cyan)]/15 text-[var(--juhe-cyan)] animate-pulse'
                  }`}>
                    {r.status === 'completed' ? '完成' : r.status === 'failed' ? '失败' : '生成中...'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 任务 ID 列表（可折叠） */}
          <details className='group'>
            <summary className='text-[10px] text-[var(--juhe-text-3)] cursor-pointer hover:text-[var(--juhe-text-2)]'>
              查看任务 ID
            </summary>
            <div className='mt-1.5 space-y-1'>
              {submittedResults.map((r) => (
                <div key={r.moduleId} className='flex items-center justify-between text-[10px] p-1.5 rounded bg-[var(--juhe-surface)]'>
                  <span className='text-[var(--juhe-text-2)] truncate flex-1'>{r.moduleName}</span>
                  <span className='text-[var(--juhe-text-3)] font-mono truncate ml-2 max-w-[120px]'>{r.taskId}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-8' onClick={() => setLightboxUrl(null)}>
          <div className='absolute inset-0 bg-black/80 backdrop-blur-sm' />
          <img src={lightboxUrl} alt='' className='relative max-w-full max-h-full object-contain rounded-xl shadow-2xl' onClick={(e) => e.stopPropagation()} />
          <button type='button' onClick={() => setLightboxUrl(null)} className='absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm'>✕</button>
        </div>
      )}
    </StepCard>
  )
}
