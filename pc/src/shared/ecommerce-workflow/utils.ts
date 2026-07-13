import type { EcommerceWorkflow, WorkflowTemplate } from './types'

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = context[key]
    return value === undefined ? '' : String(value)
  })
}

export function createWorkflowFromTemplate(template: WorkflowTemplate, category = 'tv'): EcommerceWorkflow {
  const id = generateId()
  const now = new Date().toISOString()
  return {
    id,
    templateId: template.id,
    name: `${template.id}-${category}-${formatDate(now)}`,
    category,
    context: {
      outputs: {},
      modules: [],
      market: 'us',
      language: 'en',
      ratio: '1:1',
      ...template.defaultContext
    },
    steps: template.steps.map((s) => ({
      id: s.id,
      type: s.type,
      status: 'idle'
    })),
    modules: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now
  }
}
