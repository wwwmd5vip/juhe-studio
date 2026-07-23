import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { ECOMMERCE_WORKFLOW_STREAM_CHANNEL } from '../shared/ecommerce-workflow/constants'
import { unwrapIpcResult } from '../shared/ipc-result'
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

// 统一 IPC 错误处理：主进程 handler 有两种错误形态 —— 直接 throw（Electron
// 序列化为 renderer reject）或返回 `{ success:false, error }` 信封。这里把
// 信封统一转换为 throw，renderer 只需 try/catch 一条错误处理路径。
// 注意：使用绑定的 rawInvoke，避免下方包装函数被误替换后产生递归。
const rawInvoke = ipcRenderer.invoke.bind(ipcRenderer)
async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return unwrapIpcResult(channel, await rawInvoke(channel, ...args))
}

// Custom APIs for renderer
const api = {
  // Window controls
  window: {
    minimize: () => invoke('window:minimize'),
    maximize: () => invoke('window:maximize'),
    close: () => invoke('window:close'),
    isMaximized: () => invoke('window:isMaximized')
  },

  // File path resolution (Electron 41+ File.path is deprecated)
  file: {
    getPathForFile: (file: File) => webUtils.getPathForFile(file)
  },

  // Generations
  db: {
    generations: {
      list: (filter?: unknown) => invoke('db:generations:list', filter),
      get: (id: string) => invoke('db:generations:get', id),
      create: (data: unknown) => invoke('db:generations:create', data),
      update: (id: string, data: unknown) => invoke('db:generations:update', id, data),
      delete: (id: string) => invoke('db:generations:delete', id)
    },
    workflows: {
      list: (filter?: unknown) => invoke('db:workflows:list', filter),
      create: (data: unknown) => invoke('db:workflows:create', data),
      update: (id: string, data: unknown) => invoke('db:workflows:update', id, data),
      delete: (id: string) => invoke('db:workflows:delete', id)
    },
    promptTemplates: {
      list: (filter?: unknown) => invoke('db:promptTemplates:list', filter),
      create: (data: unknown) => invoke('db:promptTemplates:create', data),
      update: (id: string, data: unknown) => invoke('db:promptTemplates:update', id, data),
      delete: (id: string) => invoke('db:promptTemplates:delete', id)
    },
    providers: {
      list: () => invoke('db:providers:list'),
      create: (data: unknown) => invoke('db:providers:create', data),
      update: (id: string, data: unknown) => invoke('db:providers:update', id, data),
      delete: (id: string) => invoke('db:providers:delete', id)
    },
    models: {
      list: (filter?: unknown) => invoke('db:models:list', filter),
      create: (data: unknown) => invoke('db:models:create', data),
      update: (id: string, data: unknown) => invoke('db:models:update', id, data),
      delete: (id: string) => invoke('db:models:delete', id)
    },
    settings: {
      get: (key: string) => invoke('db:settings:get', key),
      set: (key: string, value: string) => invoke('db:settings:set', key, value)
    }
  },

  // Updater
  updater: {
    check: () => invoke('updater:check'),
    download: () => invoke('updater:download'),
    install: () => invoke('updater:install'),
    onStatus: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    }
  },

  // Configuration (electron-store)
  config: {
    get: (key: string) => invoke('config:get', key),
    set: (key: string, value: unknown) => invoke('config:set', key, value)
  },

  // Provider operations
  provider: {
    testConnection: (id: string) => invoke('provider:test-connection', id),
    fetchModels: (id: string) => invoke('provider:fetch-models', id),
    getKey: (providerId: string) => invoke('provider:getKey', providerId)
  },

  // Generation operations
  generation: {
    create: (request: unknown) => invoke('generation:create', request),
    createBatch: (request: unknown) => invoke('generation:create-batch', request),
    get: (taskId: string) => invoke('generation:get', taskId),
    cancel: (taskId: string) => invoke('generation:cancel', taskId),
    list: () => invoke('generation:list'),
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
      invoke('workflow:node:execute', payload),
    cancelNode: (payload: { nodeId: string }) => invoke('workflow:node:cancel', payload),
    onNodeUpdate: (callback: (event: unknown, data: WorkflowNodeUpdate) => void) => {
      const handler = (_: unknown, data: WorkflowNodeUpdate) => callback(_, data)
      ipcRenderer.on('workflow:node:update', handler)
      return () => ipcRenderer.removeListener('workflow:node:update', handler)
    }
  },

  // Video generation operations
  videoGeneration: {
    create: (request: unknown) => invoke('video-generation:create', request),
    cancel: (taskId: string) => invoke('video-generation:cancel', taskId),
    modelscope: (request: unknown) => invoke('video-generation:modelscope', request)
  },

  // ComfyUI operations
  comfy: {
    run: (request: unknown) => invoke('comfy:run', request),
    cancel: (taskId: string) => invoke('comfy:cancel', taskId)
  },

  // Chat operations
  chat: {
    createSession: (req: unknown) => invoke('chat:session:create', req),
    listSessions: () => invoke('chat:session:list'),
    updateSession: (id: string, data: unknown) => invoke('chat:session:update', id, data),
    deleteSession: (id: string) => invoke('chat:session:delete', id),
    listMessages: (sessionId: string) => invoke('chat:messages:list', sessionId),
    send: (req: unknown) => invoke('chat:send', req),
    cancel: () => invoke('chat:cancel'),
    onStream: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('chat:stream', handler)
      return () => ipcRenderer.removeListener('chat:stream', handler)
    },
    listAssistants: () => invoke('chat:assistants:list'),
    getAssistant: (id: string) => invoke('chat:assistants:get', id),
    createAssistant: (data: unknown) => invoke('chat:assistants:create', data),
    updateAssistant: (id: string, data: unknown) => invoke('chat:assistants:update', id, data),
    deleteAssistant: (id: string) => invoke('chat:assistants:delete', id)
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
    }) => invoke('research:stream', req),
    cancel: (taskId: string) => invoke('research:cancel', taskId),
    onStream: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('research:stream', handler)
      return () => ipcRenderer.removeListener('research:stream', handler)
    }
  },

  // MCP operations
  mcp: {
    listServers: () => invoke('mcp:servers:list'),
    saveServers: (configs: unknown) => invoke('mcp:servers:save', configs),
    deleteServer: (id: string) => invoke('mcp:servers:delete', id),
    testServer: (config: unknown) => invoke('mcp:servers:test', config),
    listTools: (serverId?: string) => invoke('mcp:tools:list', serverId),
    callTool: (serverId: string, toolName: string, args: unknown) =>
      invoke('mcp:tools:call', serverId, toolName, args),
    disconnectAll: () => invoke('mcp:disconnect-all')
  },

  // Agent squad operations
  agentSquad: {
    run: (req: unknown) => invoke('agent-squad:run', req),
    cancel: (taskId: string) => invoke('agent-squad:cancel', taskId),
    onStream: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('agent-squad:stream', handler)
      return () => ipcRenderer.removeListener('agent-squad:stream', handler)
    }
  },

  // Quick phrases
  quickPhrases: {
    list: () => invoke('quick-phrases:list'),
    create: (data: { title: string; content: string }) => invoke('quick-phrases:create', data),
    update: (id: string, data: Partial<{ title: string; content: string; isFavorite: boolean }>) =>
      invoke('quick-phrases:update', id, data),
    delete: (id: string) => invoke('quick-phrases:delete', id),
    search: (query: string) => invoke('quick-phrases:search', query)
  },

  // Prompt system
  prompt: {
    optimize: (req: unknown) => invoke('prompt:optimize', req),
    listTemplates: () => invoke('prompt:list-templates'),
    createTemplate: (data: unknown) => invoke('prompt:create-template', data),
    updateTemplate: (id: string, data: unknown) => invoke('prompt:update-template', id, data),
    deleteTemplate: (id: string) => invoke('prompt:delete-template', id),
    searchTemplates: (query: string) => invoke('prompt:search-templates', query)
  },

  // Image processing
  imageProcess: {
    create: (request: unknown) => invoke('image-process:create', request),
    get: (taskId: string) => invoke('image-process:get', taskId),
    cancel: (taskId: string) => invoke('image-process:cancel', taskId),
    list: () => invoke('image-process:list'),
    onProgress: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('image-process:progress', handler)
      return () => ipcRenderer.removeListener('image-process:progress', handler)
    }
  },

  // Queue management
  queue: {
    getState: () => invoke('queue:state'),
    pause: () => invoke('queue:pause'),
    resume: () => invoke('queue:resume'),
    setConcurrent: (max: number) => invoke('queue:set-concurrent', max),
    cleanup: () => invoke('queue:cleanup'),
    clearAll: () => invoke('queue:clear-all'),
    retry: (taskId: string) => invoke('queue:retry', taskId),
    delete: (taskId: string) => invoke('queue:delete', taskId),
    batchAction: (request: unknown) => invoke('queue:batch-action', request),
    onStateChange: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('queue:state', handler)
      return () => ipcRenderer.removeListener('queue:state', handler)
    }
  },

  // Notifications
  notifications: {
    requestPermission: () => invoke('notifications:request-permission'),
    getSettings: () => invoke('notifications:get-settings'),
    setSettings: (settings: unknown) => invoke('notifications:set-settings', settings),
    onNotification: (callback: (event: unknown, data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(_, data)
      ipcRenderer.on('notification:show', handler)
      return () => ipcRenderer.removeListener('notification:show', handler)
    }
  },

  // Web Search
  websearch: {
    search: (query: string, providerId?: string) => invoke('websearch:search', query, providerId),
    listProviders: () => invoke('websearch:providers:list'),
    createProvider: (data: unknown) => invoke('websearch:providers:create', data),
    updateProvider: (id: string, data: unknown) => invoke('websearch:providers:update', id, data),
    deleteProvider: (id: string) => invoke('websearch:providers:delete', id)
  },

  // Skills
  skills: {
    list: () => invoke('skills:list'),
    get: (id: string) => invoke('skills:get', id),
    create: (data: {
      name: string
      title: string
      description?: string
      content: string
      category?: string
      icon?: string
      metadata?: Record<string, unknown>
    }) => invoke('skills:create', data),
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
    ) => invoke('skills:update', id, data),
    delete: (id: string) => invoke('skills:delete', id),
    toggle: (id: string) => invoke('skills:toggle', id),
    parseMarkdown: (markdown: string) => invoke('skills:parse-markdown', markdown)
  },

  // Memory (MGP Lite)
  memory: {
    write: (candidate: unknown) => invoke('memory:write', candidate),
    search: (intent: unknown) => invoke('memory:search', intent),
    get: (id: string) => invoke('memory:get', id),
    update: (id: string, patch: unknown) => invoke('memory:update', id, patch),
    expire: (id: string) => invoke('memory:expire', id),
    delete: (id: string) => invoke('memory:delete', id),
    list: (filter?: unknown) => invoke('memory:list', filter)
  },

  // Prompt library (remote prompts-service)
  promptLibrary: {
    list: (filters?: PromptListFilters) => invoke('prompt-library:list', filters),
    get: (id: number) => invoke('prompt-library:get', id),
    categories: (type?: string) => invoke('prompt-library:categories', type)
  },

  // E-commerce fixed workflow engine
  ecommerceWorkflow: {
    templates: {
      list: () => invoke('ecommerce:workflow:templates:list')
    },
    create: (req: { templateId: string; name?: string; category?: string }) =>
      invoke('ecommerce:workflow:create', req),
    list: () => invoke('ecommerce:workflow:list'),
    get: (id: string) => invoke('ecommerce:workflow:get', id),
    update: (id: string, data: Partial<EcommerceWorkflow>) => invoke('ecommerce:workflow:update', id, data),
    delete: (id: string) => invoke('ecommerce:workflow:delete', id),
    saveImage: (req: { dataUrl: string; fileName?: string }) =>
      invoke('ecommerce:workflow:image:save', req),
    runStep: (req: { workflowId: string; stepId: string; config: WorkflowStepConfig; requestId?: string }) =>
      invoke('ecommerce:workflow:step:run', req),
    cancelStep: (requestId: string) => invoke('ecommerce:workflow:step:cancel', requestId),
    submitModules: (req: {
      workflowId: string
      modules?: EcommerceWorkflow['modules']
      referenceImage?: string
      referenceMode?: 'fusion' | 'controlnet' | 'ipadapter'
    }) => invoke('ecommerce:workflow:submit', req),
    onStream: (callback: (event: unknown, data: EcommerceWorkflowStreamEvent) => void) => {
      const handler = (_: unknown, data: EcommerceWorkflowStreamEvent) => callback(_, data)
      ipcRenderer.on(ECOMMERCE_WORKFLOW_STREAM_CHANNEL, handler)
      return () => ipcRenderer.removeListener(ECOMMERCE_WORKFLOW_STREAM_CHANNEL, handler)
    }
  },

  // E-commerce showcase simple mode
  showcase: {
    generateSellingPoints: (input: GenerateSellingPointsInput) =>
      invoke('showcase:selling-points:generate', input),
    generatePlan: (input: GeneratePlanInput) => invoke('showcase:plan:generate', input),
    generateImages: (input: GenerateImagesInput) => invoke('showcase:images:generate', input),
    getTask: (id: string) => invoke('showcase:tasks:get', id),
    listTasks: (limit?: number) => invoke('showcase:tasks:list', limit),
    cancelTask: (id: string) => invoke('showcase:tasks:cancel', id)
  },

  productSet: {
    generate: (req: unknown) => invoke('ecommerce:product-set:generate', req)
  },

  modelCapability: {
    detect: (modelId: string, providerId?: string) =>
      invoke('model-capability:detect', modelId, providerId),
    detectMultiple: (models: Array<{ modelId: string; providerId: string }>) =>
      invoke('model-capability:detect-multiple', models),
    clearCache: () => invoke('model-capability:clear-cache')
  },

  workspace: {
    list: () => invoke('workspace:list'),
    get: (id: string) => invoke('workspace:get', id),
    create: (data: unknown) => invoke('workspace:create', data),
    update: (id: string, data: unknown) => invoke('workspace:update', id, data),
    delete: (id: string) => invoke('workspace:delete', id),
    stats: (id: string) => invoke('workspace:stats', id),
    uncategorizedCount: () => invoke('workspace:uncategorized-count')
  },

  // Auth — Juhe Management
  auth: {
    login: (username: string, password: string, remember: boolean, captchaId?: string, captchaCode?: string) =>
      invoke('auth:login', username, password, remember, captchaId, captchaCode),
    getCaptcha: () => invoke('auth:getCaptcha'),
    logout: () => invoke('auth:logout'),
    isAuthenticated: () => invoke('auth:isAuthenticated'),
    getUser: () => invoke('auth:getUser'),
    getProfile: () => invoke('auth:getProfile'),
    getCredentials: () => invoke('auth:getCredentials'),
    clearCredentials: () => invoke('auth:clearCredentials'),
    setBaseUrl: (url: string) => invoke('auth:setBaseUrl', url),
    getBaseUrl: () => invoke('auth:getBaseUrl'),
    listTokens: () => invoke('auth:listTokens'),
    createToken: (name: string) => invoke('auth:createToken', name),
    deleteToken: (id: number) => invoke('auth:deleteToken', id),
    getAPIKey: () => invoke('auth:getAPIKey'),
    listModels: () => invoke('auth:listModels'),
    syncModels: () => invoke('auth:syncModels')
  },
  // System — storage & data management
  system: {
    getStorageInfo: () => invoke('system:getStorageInfo'),
    clearCache: () => invoke('system:clearCache'),
    clearDatabase: () => invoke('system:clearDatabase'),
    backupDatabase: () => invoke('system:backupDatabase'),
    restoreDatabase: (filePath: string) => invoke('system:restoreDatabase', filePath),
    listBackups: () => invoke('system:listBackups'),
    getCrashReporting: () => invoke('system:getCrashReporting'),
    setCrashReporting: (enabled: boolean) => invoke('system:setCrashReporting', enabled)
  },

  // App-level actions
  app: {
    getEula: () => invoke('app:getEula'),
    quit: () => invoke('app:quit')
  },

  // Juhe Management Prompts
  juhePrompts: {
    status: () => invoke('juhe-prompts:status'),
    ensureKey: () => invoke('juhe-prompts:ensureKey'),
    list: (params?: unknown) => invoke('juhe-prompts:list', params),
    get: (id: number) => invoke('juhe-prompts:get', id),
    render: (params: { id: number; variables: Record<string, string> }) =>
      invoke('juhe-prompts:render', params),
    renderPackage: (params: { id: number; variables: Record<string, string> }) =>
      invoke('juhe-prompts:renderPackage', params),
    getDefaultVisionModel: () => invoke('juhe:get-default-vision-model'),
    getDefaultLLMModel: () => invoke('juhe:get-default-llm-model')
  },

  // Feedback
  feedback: {
    submit: (data: { type: string; title: string; content: string; contact?: string }) =>
      invoke('feedback:submit', data)
  },

  // Plugin system
  plugins: {
    list: () => invoke('plugins:list'),
    activate: (pluginId: string) => invoke('plugins:activate', pluginId),
    deactivate: (pluginId: string) => invoke('plugins:deactivate', pluginId)
  },

  // Creator OS
  creatorOs: {
    // Assets
    importAsset: (projectId: string, sourcePath: string) =>
      invoke('asset:import', projectId, sourcePath),
    createAssetFromDataUrl: (
      projectId: string,
      dataUrl: string,
      fileName: string,
      metadata?: Record<string, unknown>
    ) => invoke('asset:create-from-dataurl', projectId, dataUrl, fileName, metadata),
    listAssets: (projectId: string, filter?: { kind?: string }) =>
      invoke('asset:list', projectId, filter),
    deleteAsset: (assetId: string) =>
      invoke('asset:delete', assetId),

    // Projects
    createProject: (data: Record<string, unknown>) =>
      invoke('project:create', data),
    listProjects: () =>
      invoke('project:list'),
    getProject: (id: string) =>
      invoke('project:get', id),
    updateProject: (id: string, data: Record<string, unknown>) =>
      invoke('project:update', id, data),
    deleteProject: (id: string) =>
      invoke('project:delete', id),

    // Deliverables
    listDeliverables: (projectId: string) =>
      invoke('deliverable:list', projectId),
    updateDeliverable: (id: string, data: Record<string, unknown>) =>
      invoke('deliverable:update', id, data),

    // Product Set
    submitProductSet: (projectId: string, templateId: string) =>
      invoke('product-set:submit', projectId, templateId),
    submitProductSetWithParams: (projectId: string, slotParams: Record<string, unknown>) => {
      console.log('[Preload] submitProductSetWithParams called:', { projectId, slotCount: Object.keys(slotParams || {}).length })
      return invoke('product-set:submitWithParams', projectId, slotParams)
    },
    productSetStatus: (projectId: string) =>
      invoke('product-set:status', projectId),
    retryProductSet: (projectId: string, taskIds: string[]) =>
      invoke('product-set:retry', projectId, taskIds),
    cancelProductSet: (projectId: string) =>
      invoke('product-set:cancel', projectId),

    // Export
    exportDeliverables: (projectId: string, outputDir: string) =>
      invoke('deliverable:export', projectId, outputDir)
  },

  brandKit: {
    list: () => invoke('brand-kit:list'),
    get: (id: string) => invoke('brand-kit:get', id),
    create: (data: unknown) => invoke('brand-kit:create', data),
    update: (id: string, data: unknown) => invoke('brand-kit:update', id, data),
    delete: (id: string) => invoke('brand-kit:delete', id),
    buildPrompt: (id: string) => invoke('brand-kit:build-prompt', id)
  },

  shortVideo: {
    generateScript: (req: unknown) =>
      invoke('short-video:generate-script', req)
  },

  canvasAgent: {
    // Renderer → Main
    callTool: (documentId: string, toolName: string, args: Record<string, unknown>) =>
      invoke('canvas-agent:call-tool', documentId, toolName, args),
    listTools: () =>
      invoke('canvas-agent:list-tools'),
    pushSnapshot: (documentId: string, snapshot: unknown) =>
      ipcRenderer.send('canvas-agent:push-snapshot', documentId, snapshot),
    getSnapshot: (documentId: string) =>
      invoke('canvas-agent:get-snapshot', documentId),
    sendResult: (result: unknown) =>
      ipcRenderer.send('canvas-agent:result', result),
    destroySession: (documentId: string) =>
      invoke('canvas-agent:destroy-session', documentId),
    // Main → Renderer: MCP 工具触发的画布操作（白名单订阅，替代裸 ipcRenderer.on）
    onExecuteOps: (callback: (payload: { documentId: string; ops: unknown[] }) => void) => {
      const handler = (_: unknown, payload: { documentId: string; ops: unknown[] }) => callback(payload)
      ipcRenderer.on('canvas-agent:execute-ops', handler)
      return () => ipcRenderer.removeListener('canvas-agent:execute-ops', handler)
    }
  },

  ffmpeg: {
    detect: () => invoke('ffmpeg:detect'),
    compose: (req: unknown) => invoke('ffmpeg:compose', req),
    getDuration: (filePath: string) => invoke('ffmpeg:duration', filePath),
    onProgress: (callback: (p: unknown) => void) => {
      const handler = (_event: unknown, progress: unknown) => callback(progress)
      ipcRenderer.on('ffmpeg:progress', handler)
      return () => ipcRenderer.removeListener('ffmpeg:progress', handler)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
// Security: 不暴露 @electron-toolkit/preload 的裸 electronAPI（含通用 ipcRenderer 代理），
// 渲染进程只能通过上面裁剪后的 window.api 访问白名单 channel。
if (process.contextIsolated) {
  try {
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
  window.api = api
}
