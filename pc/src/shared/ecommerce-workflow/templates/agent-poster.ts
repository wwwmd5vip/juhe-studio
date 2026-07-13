import { DEFAULT_AGENT_IMAGE_COUNT, DEFAULT_AGENT_PROMPT_ID } from '../constants'
import type { WorkflowTemplate } from '../types'

export const agentPosterTemplate: WorkflowTemplate = {
  id: 'agent-poster',
  category: 'agent',
  nameI18nKey: 'ecommerceWorkflow.templates.agentPoster.name',
  descriptionI18nKey: 'ecommerceWorkflow.templates.agentPoster.description',
  defaultContext: {
    imageCount: DEFAULT_AGENT_IMAGE_COUNT,
    agentPromptId: DEFAULT_AGENT_PROMPT_ID,
    productText: '',
    outputs: {}
  },
  steps: [
    {
      id: 'input',
      type: 'input',
      titleI18nKey: 'ecommerceWorkflow.steps.input',
      component: 'InputStepCard',
      dependencies: [],
      configSchema: { type: 'object' }
    },
    {
      id: 'agent-vision',
      type: 'agent-vision',
      titleI18nKey: 'ecommerceWorkflow.steps.agentVision',
      component: 'AgentVisionStepCard',
      dependencies: ['input'],
      configSchema: { type: 'object' }
    },
    {
      id: 'agent-generate',
      type: 'agent-generate',
      titleI18nKey: 'ecommerceWorkflow.steps.agentGenerate',
      component: 'AgentGenerateStepCard',
      dependencies: ['agent-vision'],
      configSchema: { type: 'object' }
    },
    {
      id: 'agent-result',
      type: 'agent-result',
      titleI18nKey: 'ecommerceWorkflow.steps.agentResult',
      component: 'AgentResultStepCard',
      dependencies: ['agent-generate'],
      configSchema: { type: 'object' }
    }
  ]
}
