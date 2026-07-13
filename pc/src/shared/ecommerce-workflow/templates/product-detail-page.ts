import type { WorkflowTemplate } from '../types'

export const productDetailPageTemplate: WorkflowTemplate = {
  id: 'product-detail-page',
  category: 'ecommerce',
  nameI18nKey: 'ecommerceWorkflow.templates.productDetailPage.name',
  descriptionI18nKey: 'ecommerceWorkflow.templates.productDetailPage.description',
  defaultContext: {
    productText: '',
    platform: 'taobao',
    market: 'cn',
    language: 'zh',
    ratio: '3:4',
    selectedModuleTypes: [],
    ratioManuallySet: false
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
      outputFormat: 'text',
      configSchema: { type: 'object' },
      promptTemplate: {
        systemI18nKey: 'ecommerce.workflow.productDetailPage.copy.systemPrompt',
        userI18nKey: 'ecommerce.workflow.productDetailPage.copy.userPrompt'
      }
    },
    {
      id: 'module-recommend',
      type: 'llm',
      titleI18nKey: 'ecommerceWorkflow.steps.moduleRecommend',
      component: 'LlmStepCard',
      dependencies: ['copy'],
      outputFormat: 'text',
      configSchema: { type: 'object' },
      promptTemplate: {
        systemI18nKey: 'ecommerce.workflow.productDetailPage.moduleRecommend.systemPrompt',
        userI18nKey: 'ecommerce.workflow.productDetailPage.moduleRecommend.userPrompt'
      }
    },
    {
      id: 'module-config',
      type: 'module-config',
      titleI18nKey: 'ecommerceWorkflow.steps.moduleConfig',
      component: 'ModuleConfigStepCard',
      dependencies: ['module-recommend'],
      configSchema: { type: 'object' }
    },
    {
      id: 'module-generate',
      type: 'module-generate',
      titleI18nKey: 'ecommerceWorkflow.steps.moduleGenerate',
      component: 'ModuleGenerateStepCard',
      dependencies: ['module-config'],
      runMode: 'async',
      stream: true,
      outputFormat: 'modules',
      configSchema: { type: 'object' },
      promptTemplate: {
        systemI18nKey: 'ecommerce.workflow.productDetailPage.moduleGenerate.systemPrompt',
        userI18nKey: 'ecommerce.workflow.productDetailPage.moduleGenerate.userPrompt'
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
