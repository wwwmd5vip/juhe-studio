import type { WorkflowTemplate } from '../types'

export const platformListingTemplate: WorkflowTemplate = {
  id: 'platform-listing',
  category: 'ecommerce',
  nameI18nKey: 'ecommerceWorkflow.templates.platformListing.name',
  descriptionI18nKey: 'ecommerceWorkflow.templates.platformListing.description',
  defaultContext: {
    productText: '',
    platform: 'amazon',
    market: 'us',
    language: 'en',
    ratio: '1:1'
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
      id: 'selling-points',
      type: 'vision',
      titleI18nKey: 'ecommerceWorkflow.platformListing.steps.sellingPoints',
      component: 'VisionStepCard',
      dependencies: ['input'],
      configSchema: { type: 'object' },
      promptTemplate: {
        systemI18nKey: 'ecommerce.workflow.platformListing.sellingPoints.systemPrompt',
        userI18nKey: 'ecommerce.workflow.platformListing.sellingPoints.userPrompt'
      }
    },
    {
      id: 'structured-info',
      type: 'llm',
      titleI18nKey: 'ecommerceWorkflow.platformListing.steps.structuredInfo',
      component: 'LlmStepCard',
      dependencies: ['selling-points'],
      configSchema: { type: 'object' },
      promptTemplate: {
        systemI18nKey: 'ecommerce.workflow.platformListing.structuredInfo.systemPrompt',
        userI18nKey: 'ecommerce.workflow.platformListing.structuredInfo.userPrompt'
      }
    },
    {
      id: 'module-generate',
      type: 'module-generate',
      titleI18nKey: 'ecommerceWorkflow.platformListing.steps.moduleGenerate',
      component: 'ModuleGenerateStepCard',
      dependencies: ['structured-info'],
      runMode: 'async',
      stream: true,
      outputFormat: 'modules',
      configSchema: { type: 'object' },
      promptTemplate: {
        systemI18nKey: 'ecommerce.workflow.platformListing.moduleGenerate.systemPrompt',
        userI18nKey: 'ecommerce.workflow.platformListing.moduleGenerate.userPrompt'
      }
    },
    {
      id: 'review',
      type: 'review',
      titleI18nKey: 'ecommerceWorkflow.steps.review',
      component: 'ReviewStepCard',
      dependencies: ['module-generate'],
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
