import type { ImageSize, ImageStyle } from '@shared/types/generation'
import type { AspectRatio, Language, Market, Platform } from './enums'

export interface WorkflowContext {
  productImage?: string
  productText?: string
  platform?: Platform
  market?: Market
  language?: Language
  ratio?: AspectRatio
  imageCount?: number
  agentPromptId?: string
  agentVisionPrompts?: string[]
  agentVisionPromptsConfirmed?: boolean
  agentGeneratedImages?: AgentGeneratedImage[]
  outputs: Record<string, string>
  modules?: WorkflowModule[]
  selectedModuleTypes?: string[]
  ratioManuallySet?: boolean
}

export interface WorkflowStepConfig {
  providerId: string
  modelId: string
  systemPrompt: string
  temperature?: number
}

export interface WorkflowStepState {
  id: string
  type: string
  status: 'idle' | 'running' | 'success' | 'error'
  config?: WorkflowStepConfig
  output?: string
  error?: string
  streamOutput?: string
}

export interface WorkflowModule {
  id: string
  moduleId: string
  moduleName: string
  imagePrompt: string
  copyRequirements: string
  providerId: string
  modelId: string
  size: ImageSize
  style: ImageStyle
  seed?: number
  enabled: boolean
  submittedTaskId?: string
  status: 'draft' | 'submitted'
}

export interface AgentPrompt {
  id: string
  name: string
  prompt: string
}

export interface AgentGeneratedImage {
  id: string
  url: string
  prompt: string
  status: 'success' | 'error'
  error?: string
  createdAt: number
}

export interface EcommerceWorkflow {
  id: string
  templateId: string
  name: string
  category: string
  context: WorkflowContext
  steps: WorkflowStepState[]
  modules: WorkflowModule[]
  status: 'draft' | 'running' | 'completed' | 'error'
  createdAt: string
  updatedAt: string
}

export interface PromptTemplate {
  systemI18nKey: string
  userI18nKey: string
  outputSchema?: Record<string, unknown>
}

export interface StepConfigSchema {
  type: 'object'
  properties?: Record<string, { type: string; enum?: unknown[]; default?: unknown }>
  required?: string[]
}

export type WorkflowStepType =
  | 'input'
  | 'vision'
  | 'llm'
  | 'llm-stream'
  | 'module-generate'
  | 'review'
  | 'result'
  | 'module-config'
  | 'agent-vision'
  | 'agent-generate'
  | 'agent-result'

export interface WorkflowTemplateStep {
  id: string
  type: WorkflowStepType
  titleI18nKey: string
  component: string
  dependencies: string[]
  configSchema: StepConfigSchema
  promptTemplate?: PromptTemplate
  runMode?: 'sync' | 'async'
  stream?: boolean
  outputFormat?: 'text' | 'modules'
}

export interface StepExecutionResult {
  output: string
  modules?: WorkflowModule[]
  context?: Partial<WorkflowContext>
}

export interface WorkflowTemplate {
  id: string
  category: string
  nameI18nKey: string
  descriptionI18nKey: string
  defaultContext: Partial<WorkflowContext>
  steps: WorkflowTemplateStep[]
}

export interface StepPrompt {
  system: string
  user: string
}

export interface EcommerceWorkflowStreamEvent {
  workflowId: string
  stepId: string
  requestId: string
  type: 'text-delta' | 'module-delta' | 'done' | 'error' | 'progress'
  textDelta?: string
  moduleDelta?: Partial<WorkflowModule>
  output?: string
  modules?: WorkflowModule[]
  error?: string
  progress?: number
}
