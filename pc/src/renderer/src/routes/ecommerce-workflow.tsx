import { createFileRoute } from '@tanstack/react-router'
import { Package, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useToasts } from '@/components/ui/toast'
import { WorkflowEditor } from '@/components/ecommerce-workflow/WorkflowEditor'
import { useEcommerceWorkflowStore } from '@/stores/ecommerce-workflow'

export const Route = createFileRoute('/ecommerce-workflow')({
  component: EcommerceWorkflowPage
})

function EcommerceWorkflowPage() {
  const { t } = useTranslation()
  const toast = useToasts()
  const {
    templates,
    workflows,
    currentWorkflow,
    isLoading,
    loadTemplates,
    loadWorkflows,
    createWorkflow,
    loadWorkflow,
    deleteWorkflow
  } = useEcommerceWorkflowStore()

  useEffect(() => {
    loadTemplates()
    loadWorkflows()
  }, [loadTemplates, loadWorkflows])

  const handleCreate = async (templateId: string) => {
    try {
      await createWorkflow(templateId)
      toast.success(t('common.success'))
    } catch (err) {
      console.error('Failed to create workflow:', err)
      toast.error({ title: t('common.error'), description: err instanceof Error ? err.message : String(err) })
    }
  }

  const handleDelete = async (e: React.MouseEvent, workflowId: string) => {
    e.stopPropagation()
    try {
      await deleteWorkflow(workflowId)
      await loadWorkflows()
      toast.success(t('common.success'))
    } catch (err) {
      console.error('Failed to delete workflow:', err)
      toast.error({ title: t('common.error'), description: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className='h-[calc(100vh-3rem)] flex' style={{ background: 'var(--juhe-void)' }}>
      {/* Left sidebar */}
      <div className='w-72 shrink-0 border-r border-[var(--juhe-border)] bg-[var(--juhe-surface-2)]/30 flex flex-col'>
        <div className='p-4 border-b border-[var(--juhe-border)]'>
          <div className='flex items-center gap-2'>
            <ShoppingBag className='w-5 h-5 text-[var(--juhe-cyan)]' />
            <h1 className='text-lg font-bold'>{t('ecommerceWorkflow.title')}</h1>
          </div>
        </div>

        <div className='p-4 space-y-4 overflow-y-auto'>
          <div>
            <h2 className='text-xs font-semibold uppercase text-[var(--juhe-text-3)] mb-2'>
              {t('ecommerceWorkflow.templateList')}
            </h2>
            <div className='space-y-2'>
              {templates.map((template) => (
                <button
                  key={template.id}
                  type='button'
                  onClick={() => handleCreate(template.id)}
                  className='w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--juhe-border)] bg-[var(--juhe-void-2)] hover:border-[var(--juhe-cyan)]/40 text-left transition-colors'
                >
                  <Plus className='w-4 h-4 text-[var(--juhe-cyan)]' />
                  <div className='min-w-0'>
                    <div className='text-sm font-medium truncate'>{t(template.nameI18nKey)}</div>
                    <div className='text-xs text-[var(--juhe-text-3)] truncate'>{t(template.descriptionI18nKey)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className='text-xs font-semibold uppercase text-[var(--juhe-text-3)] mb-2'>
              {t('ecommerceWorkflow.workflows')}
            </h2>
            <div className='space-y-1'>
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentWorkflow?.id === workflow.id
                      ? 'bg-[var(--juhe-cyan)]/10 text-[var(--juhe-cyan)]'
                      : 'hover:bg-[var(--juhe-surface-2)]'
                  }`}
                >
                  <button
                    type='button'
                    onClick={() => loadWorkflow(workflow.id)}
                    className='flex items-center gap-2 flex-1 min-w-0 text-left'
                  >
                    <Package className='w-4 h-4 shrink-0' />
                    <span className='truncate'>{workflow.name}</span>
                  </button>
                  <button
                    type='button'
                    onClick={(e) => handleDelete(e, workflow.id)}
                    className='p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-opacity'
                    title={t('common.delete')}
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                  </button>
                </div>
              ))}
              {workflows.length === 0 && !isLoading && (
                <div className='text-xs text-[var(--juhe-text-3)] px-3 py-2'>{t('ecommerceWorkflow.noWorkflows')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main editor */}
      <div className='flex-1 min-w-0 overflow-y-auto p-6'>
        {currentWorkflow ? (
          <WorkflowEditor />
        ) : (
          <div className='h-full flex flex-col items-center justify-center text-[var(--juhe-text-3)]'>
            <Package className='w-12 h-12 mb-4 opacity-50' />
            <p className='text-sm'>{t('ecommerceWorkflow.selectOrCreate')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
