import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import { ECOMMERCE_WORKFLOW_STREAM_CHANNEL } from '../shared/ecommerce-workflow/constants'
import type {
  GenerateImagesInput,
  GeneratePlanInput,
  GenerateSellingPointsInput
} from '../shared/ecommerce-workflow/showcase-types'
import type {
  EcommerceWorkflow,
  EcommerceWorkflowStreamEvent,
  WorkflowStepConfig
} from '../shared/ecommerce-workflow/types'
import type { GenerationParams } from '../shared/types/generation'
import type { PromptListFilters } from '../shared/types/prompts'

interface WorkflowNodeUpdate {
  nodeId: string
  status: string
  progress?: number
  stage?: string
  result?: {
    type: string
    content: string
  }
  error?: string
}

// Custom APIs for renderer
const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },

  // Generations
  db: {
    generations: {
      list: (filter?: unknown) => ipcRenderer.invoke('db:generations:list', filter),
      get: (id: string) => ipcRenderer.invoke('db:generations:get', id),
      create: (data: unknown) => ipcRenderer.invoke('db:generations:create', data),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:generations:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:generations:delete', id)
    },
    workflows: {
      list: (filter?: unknown) => ipcRenderer.invoke('db:workflows:list', filter),
      create: (data: unknown) => ipcRenderer.invoke('db:workflows:create', data),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:workflows:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:workflows:delete', id)
    },
    promptTemplates: {
      list: (filter?: unknown) => ipcRenderer.invoke('db:promptTemplates:list', filter),
      create: (data: unknown) => ipcRenderer.invoke('db:promptTemplates:create', data),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:promptTemplates:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:promptTemplates:delete', id)
    },
    providers: {
      list: () => ipcRenderer.invoke('db:providers:list'),
      create: (data: unknown) => ipcRenderer.invoke('db:providers:create', data),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:providers:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:providers:delete', id)
    },
    models: {
      list: (filter?: unknown) => ipcRenderer.invoke('db:models:list', filter),
      create: (data: unknown) => ipcRenderer.invoke('db:models:create', data),
      update: (id: string, data: unknown) => ipcRenderer.invoke('db:models:update', id, data),
      delete: (id: string) => ipcRenderer.invoke('db:models:delete', id)
    },
    settings: {
      get: (key: string) => ipcRenderer.invoke('db:settings:get', key),
      set: (key: string, value: string) => ipcRenderer.invoke('db:settings:set', key, value)
    }
  },

  // Updater
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    }
  },

  // Configuration (electron-store)
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value)
  },

  // Provider operations
  provider: {
    testConnection: (id: string) => ipcRenderer.invoke('provider:test-connection', id),
    fetchModels: (id: string) => ipcRenderer.invoke('provider:fetch-models', id),
    getKey: (providerId: string) => ipcRenderer.invoke('provider:getKey', providerId)
  },

  // Generation operations
  generation: {
    create: (request: unknown) => ipcRenderer.invoke('generation:create', request),
    createBatch: (request: unknown) => ipcRenderer.invoke('generation:create-batch', request),
    get: (taskId: string) => ipcRenderer.invoke('generation:get', taskId),
    cancel: (taskId: string) => ipcRenderer.invoke('generation:cancel', taskId),
    list: () => ipcRenderer.invoke('generation:list'),
    onProgress: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('generation:progress', handler)
      return () => ipcRenderer.removeListener('generation:progress', handler)
    },
    onProgressBatch: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('generation:progress-batch', handler)
      return () => ipcRenderer.removeListener('generation:progress-batch', handler)
    }
  },

  // Workflow operations
  workflow: {
    executeNode: (payload: { nodeId: string; generationParams: GenerationParams }) =>
      ipcRenderer.invoke('workflow:node:execute', payload),
    cancelNode: (payload: { nodeId: string }) => ipcRenderer.invoke('workflow:node:cancel', payload),
    onNodeUpdate: (callback: (event: unknown, data: WorkflowNodeUpdate) => void) => {
      const handler = (_: unknown, data: WorkflowNodeUpdate) => callback(_, data)
      ipcRenderer.on('workflow:node:update', handler)
      return () => ipcRenderer.removeListener('workflow:node:update', handler)
    }
  },

  // Video generation operations
  videoGeneration: {
    create: (request: unknown) => ipcRenderer.invoke('video-generation:create', request),
    cancel: (taskId: string) => ipcRenderer.invoke('video-generation:cancel', taskId),
    modelscope: (request: unknown) => ipcRenderer.invoke('video-generation:modelscope', request)
  },

  // ComfyUI operations
  comfy: {
    run: (request: unknown) => ipcRenderer.invoke('comfy:run', request),
    cancel: (taskId: string) => ipcRenderer.invoke('comfy:cancel', taskId)
  },

  // Chat operations
  chat: {
    createSession: (req: unknown) => ipcRenderer.invoke('chat:session:create', req),
    listSessions: () => ipcRenderer.invoke('chat:session:list'),
    updateSession: (id: string, data: unknown) => ipcRenderer.invoke('chat:session:update', id, data),
    deleteSession: (id: string) => ipcRenderer.invoke('chat:session:delete', id),
    listMessages: (sessionId: string) => ipcRenderer.invoke('chat:messages:list', sessionId),
    send: (req: unknown) => ipcRenderer.invoke('chat:send', req),
    cancel: () => ipcRenderer.invoke('chat:cancel'),
    onStream: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('chat:stream', handler)
      return () => ipcRenderer.removeListener('chat:stream', handler)
    },
    listAssistants: () => ipcRenderer.invoke('chat:assistants:list'),
    getAssistant: (id: string) => ipcRenderer.invoke('chat:assistants:get', id),
    createAssistant: (data: unknown) => ipcRenderer.invoke('chat:assistants:create', data),
    updateAssistant: (id: string, data: unknown) => ipcRenderer.invoke('chat:assistants:update', id, data),
    deleteAssistant: (id: string) => ipcRenderer.invoke('chat:assistants:delete', id)
  },

  // Research operations (direct AI streaming without chat database)
  research: {
    stream: (req: {
      providerId: string
      modelId: string
      prompt: string
      taskId: string
      systemPrompt?: string
      temperature?: number
    }) => ipcRenderer.invoke('research:stream', req),
    cancel: (taskId: string) => ipcRenderer.invoke('research:cancel', taskId),
    onStream: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('research:stream', handler)
      return () => ipcRenderer.removeListener('research:stream', handler)
    }
  },

  // MCP operations
  mcp: {
    listServers: () => ipcRenderer.invoke('mcp:servers:list'),
    saveServers: (configs: unknown) => ipcRenderer.invoke('mcp:servers:save', configs),
    deleteServer: (id: string) => ipcRenderer.invoke('mcp:servers:delete', id),
    testServer: (config: unknown) => ipcRenderer.invoke('mcp:servers:test', config),
    listTools: (serverId?: string) => ipcRenderer.invoke('mcp:tools:list', serverId),
    callTool: (serverId: string, toolName: string, args: unknown) =>
      ipcRenderer.invoke('mcp:tools:call', serverId, toolName, args),
    disconnectAll: () => ipcRenderer.invoke('mcp:disconnect-all')
  },

  // Agent squad operations
  agentSquad: {
    run: (req: unknown) => ipcRenderer.invoke('agent-squad:run', req),
    cancel: (taskId: string) => ipcRenderer.invoke('agent-squad:cancel', taskId),
    onStream: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('agent-squad:stream', handler)
      return () => ipcRenderer.removeListener('agent-squad:stream', handler)
    }
  },

  // Quick phrases
  quickPhrases: {
    list: () => ipcRenderer.invoke('quick-phrases:list'),
    create: (data: { title: string; content: string }) => ipcRenderer.invoke('quick-phrases:create', data),
    update: (id: string, data: Partial<{ title: string; content: string; isFavorite: boolean }>) =>
      ipcRenderer.invoke('quick-phrases:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('quick-phrases:delete', id),
    search: (query: string) => ipcRenderer.invoke('quick-phrases:search', query)
  },

  // Prompt system
  prompt: {
    optimize: (req: unknown) => ipcRenderer.invoke('prompt:optimize', req),
    listTemplates: () => ipcRenderer.invoke('prompt:list-templates'),
    createTemplate: (data: unknown) => ipcRenderer.invoke('prompt:create-template', data),
    updateTemplate: (id: string, data: unknown) => ipcRenderer.invoke('prompt:update-template', id, data),
    deleteTemplate: (id: string) => ipcRenderer.invoke('prompt:delete-template', id),
    searchTemplates: (query: string) => ipcRenderer.invoke('prompt:search-templates', query)
  },

  // Image processing
  imageProcess: {
    create: (request: unknown) => ipcRenderer.invoke('image-process:create', request),
    get: (taskId: string) => ipcRenderer.invoke('image-process:get', taskId),
    cancel: (taskId: string) => ipcRenderer.invoke('image-process:cancel', taskId),
    list: () => ipcRenderer.invoke('image-process:list'),
    onProgress: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('image-process:progress', handler)
      return () => ipcRenderer.removeListener('image-process:progress', handler)
    }
  },

  // Queue management
  queue: {
    getState: () => ipcRenderer.invoke('queue:state'),
    pause: () => ipcRenderer.invoke('queue:pause'),
    resume: () => ipcRenderer.invoke('queue:resume'),
    setConcurrent: (max: number) => ipcRenderer.invoke('queue:set-concurrent', max),
    cleanup: () => ipcRenderer.invoke('queue:cleanup'),
    clearAll: () => ipcRenderer.invoke('queue:clear-all'),
    retry: (taskId: string) => ipcRenderer.invoke('queue:retry', taskId),
    delete: (taskId: string) => ipcRenderer.invoke('queue:delete', taskId),
    batchAction: (request: unknown) => ipcRenderer.invoke('queue:batch-action', request),
    onStateChange: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('queue:state', handler)
      return () => ipcRenderer.removeListener('queue:state', handler)
    }
  },

  // Notifications
  notifications: {
    requestPermission: () => ipcRenderer.invoke('notifications:request-permission'),
    getSettings: () => ipcRenderer.invoke('notifications:get-settings'),
    setSettings: (settings: unknown) => ipcRenderer.invoke('notifications:set-settings', settings),
    onNotification: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('notification:show', handler)
      return () => ipcRenderer.removeListener('notification:show', handler)
    }
  },

  // Web Search
  websearch: {
    search: (query: string, providerId?: string) => ipcRenderer.invoke('websearch:search', query, providerId),
    listProviders: () => ipcRenderer.invoke('websearch:providers:list'),
    createProvider: (data: unknown) => ipcRenderer.invoke('websearch:providers:create', data),
    updateProvider: (id: string, data: unknown) => ipcRenderer.invoke('websearch:providers:update', id, data),
    deleteProvider: (id: string) => ipcRenderer.invoke('websearch:providers:delete', id)
  },

  // Skills
  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    get: (id: string) => ipcRenderer.invoke('skills:get', id),
    create: (data: {
      name: string
      title: string
      description?: string
      content: string
      category?: string
      icon?: string
      metadata?: Record<string, unknown>
    }) => ipcRenderer.invoke('skills:create', data),
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
    ) => ipcRenderer.invoke('skills:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('skills:delete', id),
    toggle: (id: string) => ipcRenderer.invoke('skills:toggle', id),
    parseMarkdown: (markdown: string) => ipcRenderer.invoke('skills:parse-markdown', markdown)
  },

  // Memory (MGP Lite)
  memory: {
    write: (candidate: unknown) => ipcRenderer.invoke('memory:write', candidate),
    search: (intent: unknown) => ipcRenderer.invoke('memory:search', intent),
    get: (id: string) => ipcRenderer.invoke('memory:get', id),
    update: (id: string, patch: unknown) => ipcRenderer.invoke('memory:update', id, patch),
    expire: (id: string) => ipcRenderer.invoke('memory:expire', id),
    delete: (id: string) => ipcRenderer.invoke('memory:delete', id),
    list: (filter?: unknown) => ipcRenderer.invoke('memory:list', filter)
  },

  // Prompt library (remote prompts-service)
  promptLibrary: {
    list: (filters?: PromptListFilters) => ipcRenderer.invoke('prompt-library:list', filters),
    get: (id: number) => ipcRenderer.invoke('prompt-library:get', id),
    categories: (type?: string) => ipcRenderer.invoke('prompt-library:categories', type)
  },

  // E-commerce fixed workflow engine
  ecommerceWorkflow: {
    templates: {
      list: () => ipcRenderer.invoke('ecommerce:workflow:templates:list')
    },
    create: (req: { templateId: string; name?: string; category?: string }) =>
      ipcRenderer.invoke('ecommerce:workflow:create', req),
    list: () => ipcRenderer.invoke('ecommerce:workflow:list'),
    get: (id: string) => ipcRenderer.invoke('ecommerce:workflow:get', id),
    update: (id: string, data: Partial<EcommerceWorkflow>) => ipcRenderer.invoke('ecommerce:workflow:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('ecommerce:workflow:delete', id),
    saveImage: (req: { dataUrl: string; fileName?: string }) =>
      ipcRenderer.invoke('ecommerce:workflow:image:save', req),
    runStep: (req: { workflowId: string; stepId: string; config: WorkflowStepConfig; requestId?: string }) =>
      ipcRenderer.invoke('ecommerce:workflow:step:run', req),
    cancelStep: (requestId: string) => ipcRenderer.invoke('ecommerce:workflow:step:cancel', requestId),
    submitModules: (req: {
      workflowId: string
      modules?: EcommerceWorkflow['modules']
      referenceImage?: string
      referenceMode?: 'fusion' | 'controlnet' | 'ipadapter'
    }) => ipcRenderer.invoke('ecommerce:workflow:submit', req),
    onStream: (callback: (event: unknown, data: EcommerceWorkflowStreamEvent) => void) => {
      const handler = (_: unknown, data: EcommerceWorkflowStreamEvent) => callback(_, data)
      ipcRenderer.on(ECOMMERCE_WORKFLOW_STREAM_CHANNEL, handler)
      return () => ipcRenderer.removeListener(ECOMMERCE_WORKFLOW_STREAM_CHANNEL, handler)
    }
  },

  // E-commerce showcase simple mode
  showcase: {
    generateSellingPoints: (input: GenerateSellingPointsInput) =>
      ipcRenderer.invoke('showcase:selling-points:generate', input),
    generatePlan: (input: GeneratePlanInput) => ipcRenderer.invoke('showcase:plan:generate', input),
    generateImages: (input: GenerateImagesInput) => ipcRenderer.invoke('showcase:images:generate', input),
    getTask: (id: string) => ipcRenderer.invoke('showcase:tasks:get', id),
    listTasks: (limit?: number) => ipcRenderer.invoke('showcase:tasks:list', limit),
    cancelTask: (id: string) => ipcRenderer.invoke('showcase:tasks:cancel', id)
  },

  // Auth — Juhe Management
  auth: {
    login: (username: string, password: string, remember: boolean, captchaId?: string, captchaCode?: string) =>
      ipcRenderer.invoke('auth:login', username, password, remember, captchaId, captchaCode),
    getCaptcha: () => ipcRenderer.invoke('auth:getCaptcha'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),
    getUser: () => ipcRenderer.invoke('auth:getUser'),
    getProfile: () => ipcRenderer.invoke('auth:getProfile'),
    getCredentials: () => ipcRenderer.invoke('auth:getCredentials'),
    clearCredentials: () => ipcRenderer.invoke('auth:clearCredentials'),
    setBaseUrl: (url: string) => ipcRenderer.invoke('auth:setBaseUrl', url),
    getBaseUrl: () => ipcRenderer.invoke('auth:getBaseUrl'),
    listTokens: () => ipcRenderer.invoke('auth:listTokens'),
    createToken: (name: string) => ipcRenderer.invoke('auth:createToken', name),
    deleteToken: (id: number) => ipcRenderer.invoke('auth:deleteToken', id),
    getAPIKey: () => ipcRenderer.invoke('auth:getAPIKey'),
    listModels: () => ipcRenderer.invoke('auth:listModels'),
    syncModels: () => ipcRenderer.invoke('auth:syncModels')
  },
  // System — storage & data management
  system: {
    getStorageInfo: () => ipcRenderer.invoke('system:getStorageInfo'),
    clearCache: () => ipcRenderer.invoke('system:clearCache'),
    clearDatabase: () => ipcRenderer.invoke('system:clearDatabase'),
    backupDatabase: () => ipcRenderer.invoke('system:backupDatabase'),
    restoreDatabase: (filePath: string) => ipcRenderer.invoke('system:restoreDatabase', filePath),
    listBackups: () => ipcRenderer.invoke('system:listBackups'),
    getCrashReporting: () => ipcRenderer.invoke('system:getCrashReporting'),
    setCrashReporting: (enabled: boolean) => ipcRenderer.invoke('system:setCrashReporting', enabled)
  },

  // App-level actions
  app: {
    getEula: () => ipcRenderer.invoke('app:getEula'),
    quit: () => ipcRenderer.invoke('app:quit')
  },

  // Juhe Management Prompts
  juhePrompts: {
    status: () => ipcRenderer.invoke('juhe-prompts:status'),
    ensureKey: () => ipcRenderer.invoke('juhe-prompts:ensureKey'),
    list: (params?: unknown) => ipcRenderer.invoke('juhe-prompts:list', params),
    get: (id: number) => ipcRenderer.invoke('juhe-prompts:get', id),
    render: (params: { id: number; variables: Record<string, string> }) =>
      ipcRenderer.invoke('juhe-prompts:render', params),
    renderPackage: (params: { id: number; variables: Record<string, string> }) =>
      ipcRenderer.invoke('juhe-prompts:renderPackage', params),
    getDefaultVisionModel: () => ipcRenderer.invoke('juhe:get-default-vision-model'),
    getDefaultLLMModel: () => ipcRenderer.invoke('juhe:get-default-llm-model')
  },

  // Feedback
  feedback: {
    submit: (data: { type: string; title: string; content: string; contact?: string }) =>
      ipcRenderer.invoke('feedback:submit', data)
  },

  // Plugin system
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    activate: (pluginId: string) => ipcRenderer.invoke('plugins:activate', pluginId),
    deactivate: (pluginId: string) => ipcRenderer.invoke('plugins:deactivate', pluginId)
  },

  // Creator OS
  creatorOs: {
    importAsset: (projectId: string, sourcePath: string) =>
      ipcRenderer.invoke('asset:import', projectId, sourcePath),
    listAssets: (projectId: string, filter?: { kind?: string }) =>
      ipcRenderer.invoke('asset:list', projectId, filter),
    deleteAsset: (assetId: string) =>
      ipcRenderer.invoke('asset:delete', assetId),
    listDeliverables: (projectId: string) =>
      ipcRenderer.invoke('deliverable:list', projectId)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    // Expose Sentry DSN for renderer error tracking
    if (process.env.SENTRY_DSN) {
      contextBridge.exposeInMainWorld('__SENTRY_DSN__', process.env.SENTRY_DSN)
    }
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
