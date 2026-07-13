import type { WorkflowTemplate } from '../types'
import { agentPosterTemplate } from './agent-poster'
import { platformListingTemplate } from './platform-listing'
import { productDetailPageTemplate } from './product-detail-page'
import { productSetTemplate } from './product-set'

export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  [productSetTemplate.id]: productSetTemplate,
  [platformListingTemplate.id]: platformListingTemplate,
  [productDetailPageTemplate.id]: productDetailPageTemplate,
  [agentPosterTemplate.id]: agentPosterTemplate
}

export function getWorkflowTemplate(id: string): WorkflowTemplate {
  const template = WORKFLOW_TEMPLATES[id]
  if (!template) throw new Error(`Unknown workflow template: ${id}`)
  return template
}

export const WORKFLOW_TEMPLATE_IDS = Object.keys(WORKFLOW_TEMPLATES)
