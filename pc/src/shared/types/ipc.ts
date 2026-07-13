/**
 * IPC Type Definitions
 * Shared between main process, preload, and renderer
 */

import type {
  GenerateImagesInput,
  GeneratePlanInput,
  GenerateSellingPointsInput,
  ShowcaseTask
} from '../ecommerce-workflow/showcase-types'
import type {
  EcommerceWorkflow,
  EcommerceWorkflowStreamEvent,
  StepExecutionResult,
  WorkflowStepConfig
} from '../ecommerce-workflow/types'
import type { GenerationOutput } from './generation'
import type { PromptDetail, PromptListFilters, PromptListResponse } from './prompts'

// Generation types
export interface GenerationRequest {
  id: string
  type: 'image' | 'video' | 'text'
  providerId: string
  modelId: string
  prompt: string
  negativePrompt?: string
  parameters?: Record<string, unknown>
  referenceImages?: string[]
}

export interface GenerationResult {
  id: string
  type: string
  providerId: string
  modelId: string
  prompt: string
  negativePrompt?: string
  seed?: number
  width?: number
  height?: number
  steps?: number
  cfgScale?: number
  parameters?: Record<string, unknown>
  outputs?: GenerationOutput[]
  resultUrls?: string[]
  status: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface GenerationFilter {
  type?: string
  status?: string
  providerId?: string
  modelId?: string
  search?: string
  limit?: number
  offset?: number
}

// Workflow types
export interface WorkflowResult {
  id: string
  name: string
  description?: string
  nodes: unknown
  edges: unknown
  viewport?: unknown
  viewMode?: string
  isFavorite?: boolean
  createdAt: string
  updatedAt: string
}

// Prompt template types
export interface PromptTemplateResult {
  id: string
  category: string
  name: string
  content: string
  description?: string
  tags?: string[]
  isFavorite?: boolean
  usageCount?: number
  createdAt: string
  updatedAt: string
}

// Provider types
export interface ProviderResult {
  id: string
  name: string
  type: string
  baseUrl?: string
  apiKey?: string
  isEnabled?: boolean
  isCustom?: boolean
  presetId?: string
  createdAt: string
  updatedAt: string
}

// Model types
export interface ModelResult {
  id: string
  providerId: string
  name: string
  displayName?: string
  type: string
  capabilities?: Record<string, unknown>
  parameters?: Record<string, unknown>
  isEnabled?: boolean
  createdAt: string
}

// Stream chunk for progressive generation updates
export interface StreamChunk {
  jobId: string
  stage: string
  progress: number
  message?: string
  result?: Partial<GenerationResult>
}

// Image processing
export interface ImageProcessTask {
  id: string
  type: 'smart-repair' | 'inpaint' | 'outpainting' | 'remove-bg' | 'upscale' | 'variant'
  inputPath: string
  options?: Record<string, unknown>
}

// Window state
export interface WindowState {
  isMaximized: boolean
  isMinimized: boolean
  isFocused: boolean
}

// API exposed to renderer via contextBridge
export interface RendererAPI {
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
  }
  db: {
    generations: {
      list: (filter?: GenerationFilter) => Promise<GenerationResult[]>
      get: (id: string) => Promise<GenerationResult | null>
      create: (data: Record<string, unknown>) => Promise<GenerationResult>
      update: (id: string, data: Record<string, unknown>) => Promise<boolean>
      delete: (id: string) => Promise<boolean>
    }
    workflows: {
      list: (filter?: { isFavorite?: boolean; limit?: number }) => Promise<WorkflowResult[]>
      create: (data: Record<string, unknown>) => Promise<WorkflowResult>
      update: (id: string, data: Record<string, unknown>) => Promise<boolean>
      delete: (id: string) => Promise<boolean>
    }
    promptTemplates: {
      list: (filter?: { category?: string; search?: string; isFavorite?: boolean }) => Promise<PromptTemplateResult[]>
      create: (data: Record<string, unknown>) => Promise<PromptTemplateResult>
      update: (id: string, data: Record<string, unknown>) => Promise<boolean>
      delete: (id: string) => Promise<boolean>
    }
    providers: {
      list: () => Promise<ProviderResult[]>
      create: (data: Record<string, unknown>) => Promise<ProviderResult>
      update: (id: string, data: Record<string, unknown>) => Promise<boolean>
      delete: (id: string) => Promise<boolean>
    }
    models: {
      list: (filter?: { providerId?: string; type?: string }) => Promise<ModelResult[]>
      create: (data: Record<string, unknown>) => Promise<ModelResult>
      update: (id: string, data: Record<string, unknown>) => Promise<boolean>
      delete: (id: string) => Promise<boolean>
    }
    settings: {
      get: (key: string) => Promise<string | null>
      set: (key: string, value: string) => Promise<boolean>
    }
  }
  updater: {
    check: () => Promise<{ success: boolean; error?: string }>
    download: () => Promise<{ success: boolean; error?: string }>
    install: () => Promise<void>
    onStatus: (callback: (event: unknown, data: { status: string; data?: unknown }) => void) => () => void
  }
  config: {
    get: <T = unknown>(key: string) => Promise<T | undefined>
    set: <T = unknown>(key: string, value: T) => Promise<void>
  }
  provider: {
    testConnection: (id: string) => Promise<{ success: boolean; message: string; latency?: number }>
    fetchModels: (
      id: string
    ) => Promise<{ providerId: string; models: unknown[]; total: number; added: number; updated: number }>
    getKey: (providerId: string) => Promise<{ apiKey?: string; accessKeyId?: string; secretAccessKey?: string } | null>
  }
  generation: {
    create: (request: unknown) => Promise<{ taskId: string; status: string }>
    createBatch: (request: unknown) => Promise<{ taskIds: string[]; status: string }>
    get: (taskId: string) => Promise<unknown>
    cancel: (taskId: string) => Promise<boolean>
    list: () => Promise<unknown[]>
    onProgress: (callback: (event: unknown, data: unknown) => void) => () => void
    onProgressBatch: (callback: (event: unknown, data: unknown) => void) => () => void
  }
  workflow: {
    executeNode: (payload: { nodeId: string; generationParams: unknown }) => Promise<Record<string, unknown>>
    cancelNode: (payload: { nodeId: string }) => Promise<boolean>
    onNodeUpdate: (
      callback: (
        event: unknown,
        data: { nodeId: string; status: string; progress?: number; result?: unknown; outputs?: unknown; error?: string }
      ) => void
    ) => () => void
  }
  videoGeneration: {
    create: (request: unknown) => Promise<{ taskId: string }>
    cancel: (taskId: string) => Promise<void>
    modelscope: (request: unknown) => Promise<{ taskId: string }>
  }
  comfy: {
    run: (request: unknown) => Promise<{ taskId: string }>
    cancel: (taskId: string) => Promise<void>
  }
  queue: {
    getState: () => Promise<unknown>
    pause: () => Promise<boolean>
    resume: () => Promise<boolean>
    setConcurrent: (max: number) => Promise<boolean>
    cleanup: () => Promise<number>
    clearAll: () => Promise<number>
    retry: (taskId: string) => Promise<boolean>
    delete: (taskId: string) => Promise<boolean>
    batchAction: (request: unknown) => Promise<string[]>
    onStateChange: (callback: (event: unknown, data: unknown) => void) => () => void
  }
  chat: {
    createSession: (req: unknown) => Promise<{ id: string; title: string }>
    listSessions: () => Promise<unknown[]>
    updateSession: (id: string, data: unknown) => Promise<boolean>
    deleteSession: (id: string) => Promise<boolean>
    listMessages: (sessionId: string) => Promise<unknown[]>
    send: (req: unknown) => Promise<{ messageId: string; content: string }>
    cancel: () => Promise<{ cancelled: boolean }>
    onStream: (callback: (event: unknown, data: unknown) => void) => () => void
    listAssistants: () => Promise<unknown[]>
    getAssistant: (id: string) => Promise<unknown>
    createAssistant: (data: unknown) => Promise<unknown>
    updateAssistant: (id: string, data: unknown) => Promise<boolean>
    deleteAssistant: (id: string) => Promise<boolean>
  }
  research: {
    stream: (req: {
      providerId: string
      modelId: string
      prompt: string
      taskId: string
    }) => Promise<{ content: string; error?: string }>
    onStream: (callback: (event: unknown, data: unknown) => void) => () => void
    cancel: (taskId: string) => Promise<void>
  }
  quickPhrases: {
    list: () => Promise<
      Array<{ id: string; title: string; content: string; isFavorite?: boolean; createdAt: string; updatedAt: string }>
    >
    create: (data: {
      title: string
      content: string
    }) => Promise<{ id: string; title: string; content: string; createdAt: string; updatedAt: string }>
    update: (id: string, data: Partial<{ title: string; content: string; isFavorite: boolean }>) => Promise<boolean>
    delete: (id: string) => Promise<boolean>
    search: (
      query: string
    ) => Promise<
      Array<{ id: string; title: string; content: string; isFavorite?: boolean; createdAt: string; updatedAt: string }>
    >
  }
  prompt: {
    optimize: (req: unknown) => Promise<{ original: string; optimized: string; explanation?: string }>
    listTemplates: () => Promise<unknown[]>
    createTemplate: (data: unknown) => Promise<string>
    updateTemplate: (id: string, data: unknown) => Promise<boolean>
    deleteTemplate: (id: string) => Promise<boolean>
    searchTemplates: (query: string) => Promise<unknown[]>
  }
  imageProcess: {
    create: (request: unknown) => Promise<{ taskId: string; status: string }>
    get: (taskId: string) => Promise<unknown>
    cancel: (taskId: string) => Promise<boolean>
    list: () => Promise<unknown[]>
    onProgress: (callback: (event: unknown, data: unknown) => void) => () => void
  }
  notifications: {
    requestPermission: () => Promise<boolean>
    getSettings: () => Promise<unknown>
    setSettings: (settings: unknown) => Promise<unknown>
    onNotification: (
      callback: (event: unknown, data: { type: string; title: string; body: string }) => void
    ) => () => void
  }
  websearch: {
    search: (
      query: string,
      providerId?: string
    ) => Promise<{
      results: Array<{ title: string; url: string; content?: string }>
      query: string
      providerId: string
    }>
    listProviders: () => Promise<
      Array<{
        id: string
        name: string
        type: string
        apiHost?: string
        isEnabled?: boolean
        createdAt: string
        updatedAt: string
      }>
    >
    createProvider: (
      data: unknown
    ) => Promise<{ id: string; name: string; type: string; createdAt: string; updatedAt: string }>
    updateProvider: (id: string, data: unknown) => Promise<boolean>
    deleteProvider: (id: string) => Promise<boolean>
  }
  skills: {
    list: () => Promise<
      Array<{
        id: string
        name: string
        title: string
        description?: string
        content: string
        category?: string
        isEnabled?: boolean
        isBuiltin?: boolean
        metadata?: Record<string, unknown>
        icon?: string
        orderKey?: number
        createdAt: string
        updatedAt: string
      }>
    >
    get: (id: string) => Promise<{
      id: string
      name: string
      title: string
      description?: string
      content: string
      category?: string
      isEnabled?: boolean
      isBuiltin?: boolean
      metadata?: Record<string, unknown>
      icon?: string
      orderKey?: number
      createdAt: string
      updatedAt: string
    } | null>
    create: (data: {
      name: string
      title: string
      description?: string
      content: string
      category?: string
      icon?: string
      metadata?: Record<string, unknown>
    }) => Promise<{
      id: string
      name: string
      title: string
      description?: string
      content: string
      category?: string
      isEnabled?: boolean
      isBuiltin?: boolean
      metadata?: Record<string, unknown>
      icon?: string
      orderKey?: number
      createdAt: string
      updatedAt: string
    }>
    update: (
      id: string,
      data: Partial<{
        name: string
        title: string
        description?: string
        content: string
        category?: string
        isEnabled?: boolean
        isBuiltin?: boolean
        metadata?: Record<string, unknown>
        icon?: string
        orderKey?: number
      }>
    ) => Promise<boolean>
    delete: (id: string) => Promise<boolean>
    toggle: (id: string) => Promise<boolean>
    parseMarkdown: (markdown: string) => Promise<{ content: string; data: Record<string, unknown> }>
  }
  memory: {
    write: (candidate: unknown) => Promise<import('./memory').Memory>
    search: (intent: unknown) => Promise<import('./memory').Memory[]>
    get: (id: string) => Promise<import('./memory').Memory | null>
    update: (id: string, patch: unknown) => Promise<boolean>
    expire: (id: string) => Promise<boolean>
    delete: (id: string) => Promise<boolean>
    list: (filter?: unknown) => Promise<import('./memory').Memory[]>
  }
  promptLibrary: {
    list: (filters?: PromptListFilters) => Promise<PromptListResponse>
    get: (id: number) => Promise<{ item: PromptDetail; rendered?: string }>
    categories: (
      type?: 'image' | 'agent' | 'package'
    ) => Promise<{ data: Array<{ id: number; name: string; type: string }>; pagination: { total: number } }>
  }
  ecommerceWorkflow: {
    templates: {
      list: () => Promise<
        Array<{
          id: string
          category: string
          nameI18nKey: string
          descriptionI18nKey: string
          defaultContext: Partial<EcommerceWorkflow['context']>
        }>
      >
    }
    create: (req: { templateId: string; name?: string; category?: string }) => Promise<EcommerceWorkflow>
    list: () => Promise<EcommerceWorkflow[]>
    get: (id: string) => Promise<EcommerceWorkflow | null>
    update: (id: string, data: Partial<EcommerceWorkflow>) => Promise<boolean>
    delete: (id: string) => Promise<boolean>
    saveImage: (req: { dataUrl: string; fileName?: string }) => Promise<string>
    runStep: (req: {
      workflowId: string
      stepId: string
      config: WorkflowStepConfig
      requestId?: string
    }) => Promise<StepExecutionResult>
    cancelStep: (requestId: string) => Promise<void>
    submitModules: (req: {
      workflowId: string
      modules?: EcommerceWorkflow['modules']
      referenceImage?: string
      referenceMode?: 'fusion' | 'controlnet' | 'ipadapter'
    }) => Promise<{ submissions: Array<{ moduleId: string; taskId: string }>; modules: EcommerceWorkflow['modules'] }>
    onStream: (callback: (event: unknown, data: EcommerceWorkflowStreamEvent) => void) => () => void
  }
  showcase: {
    generateSellingPoints: (input: GenerateSellingPointsInput) => Promise<string>
    generatePlan: (input: GeneratePlanInput) => Promise<string>
    generateImages: (input: GenerateImagesInput) => Promise<string>
    getTask: (id: string) => Promise<ShowcaseTask | undefined>
    listTasks: (limit?: number) => Promise<ShowcaseTask[]>
    cancelTask: (id: string) => Promise<void>
  }
  auth: {
    login: (
      username: string,
      password: string,
      remember: boolean,
      captchaId?: string,
      captchaCode?: string
    ) => Promise<{
      success: boolean
      data?: {
        user: {
          id: number
          username: string
          role: number
          status: number
          group: string
          quota: number
          used_quota: number
        }
        token: string
      }
      error?: string
    }>
    getCaptcha: () => Promise<{
      success: boolean
      data?: { captcha_id: string; image: string }
      error?: string
    }>
    logout: () => Promise<{ success: boolean; error?: string }>
    isAuthenticated: () => Promise<boolean>
    getUser: () => Promise<{
      success: boolean
      data?: {
        id: number
        username: string
        role: number
        status: number
        group: string
        quota: number
        used_quota: number
      }
      error?: string
    }>
    getProfile: () => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
    getCredentials: () => Promise<{
      success: boolean
      data?: { username: string; password: string } | null
      error?: string
    }>
    clearCredentials: () => Promise<{ success: boolean; error?: string }>
    setBaseUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    getBaseUrl: () => Promise<string>
    listTokens: () => Promise<{ success: boolean; data?: Array<Record<string, unknown>>; error?: string }>
    createToken: (name: string) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
    deleteToken: (id: number) => Promise<{ success: boolean; error?: string }>
    getAPIKey: () => Promise<{ success: boolean; data?: string | null; error?: string }>
    listModels: () => Promise<{ success: boolean; data?: Array<{ id: string }>; error?: string }>
    syncModels: () => Promise<{ success: boolean; data?: { providerId: string; synced: number }; error?: string }>
  }
  system: {
    getStorageInfo: () => Promise<{
      dbPath: string
      dbSize: number
      dbSizeFormatted: string
      cfgPath: string
      cfgSize: number
      cfgSizeFormatted: string
    }>
    clearCache: () => Promise<{ success: boolean; error?: string }>
    clearDatabase: () => Promise<{ success: boolean; error?: string }>
    backupDatabase: () => Promise<{ success: boolean; path?: string; size?: number; error?: string }>
    restoreDatabase: (filePath: string) => Promise<{ success: boolean; restored?: number; error?: string }>
    listBackups: () => Promise<Array<{ name: string; path: string; size: number; createdAt: number }>>
    getCrashReporting: () => Promise<boolean>
    setCrashReporting: (enabled: boolean) => Promise<{ success: boolean }>
  }
  juhePrompts: {
    status: () => Promise<{
      success: boolean
      data?: { connected: boolean; baseUrl: string; hasKey: boolean }
      error?: string
    }>
    ensureKey: () => Promise<{ success: boolean; data?: { synced: number; hasKey: boolean }; error?: string }>
    list: (params?: {
      type?: 'image' | 'agent' | 'package'
      page?: number
      page_size?: number
      category_id?: number
      tag?: string
      keyword?: string
    }) => Promise<{ success: boolean; data?: { data: unknown[]; pagination: unknown }; error?: string }>
    get: (id: number) => Promise<{ success: boolean; data?: unknown; error?: string }>
    render: (params: {
      id: number
      variables: Record<string, string>
    }) => Promise<{ success: boolean; data?: { content: string }; error?: string }>
    renderPackage: (params: {
      id: number
      variables: Record<string, string>
    }) => Promise<{ success: boolean; data?: { prompt_id: number; title: string; content: string }[]; error?: string }>
    getDefaultVisionModel: () => Promise<string>
    getDefaultLLMModel: () => Promise<string>
  }
  app: {
    getEula: () => Promise<string>
    quit: () => Promise<void>
  }
  plugins: {
    list: () => Promise<
      Array<{
        manifest: { id: string; name: string; version: string; description: string; icon?: string }
        status: string
        file: string
      }>
    >
    activate: (pluginId: string) => Promise<{ success: boolean; error?: string }>
    deactivate: (pluginId: string) => Promise<{ success: boolean; error?: string }>
  }
  feedback: {
    submit: (data: { type: string; title: string; content: string; contact?: string }) => Promise<unknown>
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    api: RendererAPI
    electron: {
      process: {
        versions: {
          chrome: string
          node: string
          electron: string
        }
      }
    }
  }
}
