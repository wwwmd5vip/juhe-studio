import type { WorkflowTemplate } from '../types'

export const productSetTemplate: WorkflowTemplate = {
  id: 'product-set',
  category: 'ecommerce',
  nameI18nKey: 'ecommerceWorkflow.templates.productSet.name',
  descriptionI18nKey: 'ecommerceWorkflow.templates.productSet.description',
  defaultContext: {
    productText: '',
    market: 'cn',
    language: 'zh'
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
      id: 'vision',
      type: 'vision',
      titleI18nKey: 'ecommerceWorkflow.steps.vision',
      component: 'VisionStepCard',
      dependencies: ['input'],
      configSchema: { type: 'object' },
      promptTemplate: {
        systemI18nKey: 'ecommerce.workflow.productSet.vision.systemPrompt',
        userI18nKey: 'ecommerce.workflow.productSet.vision.userPrompt'
      }
    },
    {
      id: 'copy',
      type: 'llm',
      titleI18nKey: 'ecommerceWorkflow.steps.copy',
      component: 'LlmStepCard',
      dependencies: ['vision'],
      configSchema: { type: 'object' },
      promptTemplate: {
        systemI18nKey: 'ecommerce.workflow.productSet.copy.systemPrompt',
        userI18nKey: 'ecommerce.workflow.productSet.copy.userPrompt'
      }
    },
    {
      id: 'split',
      type: 'llm',
      titleI18nKey: 'ecommerceWorkflow.steps.split',
      component: 'LlmStepCard',
      dependencies: ['copy'],
      outputFormat: 'modules',
      configSchema: { type: 'object' },
      promptTemplate: {
        systemI18nKey: 'ecommerce.workflow.productSet.split.systemPrompt',
        userI18nKey: 'ecommerce.workflow.productSet.split.userPrompt'
      }
    },
    {
      id: 'review',
      type: 'review',
      titleI18nKey: 'ecommerceWorkflow.steps.review',
      component: 'ReviewStepCard',
      dependencies: ['split'],
      configSchema: { type: 'object' }
    },
    {
      id: 'result',
      type: 'result',
      titleI18nKey: 'ecommerceWorkflow.steps.result',
      component: 'ResultStepCard',
      dependencies: ['review'],
      configSchema: { type: 'object' }
    }
  ]
}
