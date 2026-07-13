import * as Sentry from '@sentry/electron/renderer'

// Dev-mode mock: comprehensive IPC stub for browser development
if (!(window as unknown as { api?: unknown }).api) {
  const noop = () => Promise.reject(new Error('IPC not available in dev mode'))
  const noopGet = () => Promise.resolve(null)
  const noopList = () => Promise.resolve([]) as Promise<unknown>
  const noopVoid = () => Promise.resolve(undefined)
  const unsub = () => () => undefined
  const store: Record<string, unknown> = {}
  const api: Record<string, unknown> = {
    app: { getEula: () => Promise.resolve({ accepted: true, version: '1.0' }), quit: noop },
    auth: { login: noop, logout: noop, isAuthenticated: () => Promise.resolve(false), getCredentials: noopGet, getProfile: noopGet, getUser: noopGet, clearCredentials: noop, setBaseUrl: noop, getBaseUrl: () => Promise.resolve(''), listTokens: noopList, createToken: noop, deleteToken: noop, getAPIKey: () => Promise.resolve(''), listModels: noopList, syncModels: noop },
    config: { get: (k: string) => Promise.resolve(store[k] ?? null), set: (k: string, v: unknown) => { store[k] = v; return Promise.resolve(undefined) } },
    provider: { testConnection: noop, fetchModels: noop, getKey: noopGet },
    generation: { create: noop, createBatch: noop, get: noopGet, cancel: noop, list: noopList, onProgress: unsub, onProgressBatch: unsub },
    workflow: { executeNode: noop, cancelNode: noop, onNodeUpdate: unsub },
    videoGeneration: { create: noop, cancel: noop, modelscope: noop },
    comfy: { run: noop, cancel: noop },
    chat: { createSession: noop, listSessions: noopList, updateSession: noop, deleteSession: noop, listMessages: noopList, send: noop, cancel: noopVoid, onStream: unsub, listAssistants: noopList, getAssistant: noopGet, createAssistant: noop, updateAssistant: noop, deleteAssistant: noop },
    research: { stream: noop, cancel: noop, onStream: unsub },
    mcp: { listServers: noopList, saveServers: noop, testServer: () => Promise.resolve({ success: true }) },
    quickPhrases: { list: noopList, create: noop, update: noop, delete: noop, search: () => Promise.resolve([]) },
    prompt: { optimize: () => Promise.resolve({ optimized: '' }), listTemplates: () => Promise.resolve([]), createTemplate: noop, updateTemplate: noop, deleteTemplate: noop, searchTemplates: () => Promise.resolve([]) },
    imageProcess: { create: noop, get: noopGet, cancel: noop, list: noopList, onProgress: unsub },
    queue: { getState: () => Promise.resolve({ isPaused: false, maxConcurrent: 3, totalTasks: 0, pendingCount: 0, runningCount: 0, completedCount: 0, failedCount: 0 }), pause: noopVoid, resume: noopVoid, setConcurrent: noop, cleanup: noop, clearAll: noop, retry: noop, delete: noop, batchAction: noop, onStateChange: unsub },
    notifications: { requestPermission: () => Promise.resolve('granted'), getSettings: () => Promise.resolve({}), setSettings: noop, onNotification: unsub },
    websearch: { search: () => Promise.resolve({ results: [] }), listProviders: noopList, createProvider: noop, updateProvider: noop, deleteProvider: noop },
    skills: { list: noopList, get: noopGet, create: noop, update: noop, delete: noop, toggle: noop, parseMarkdown: () => Promise.resolve({}) },
    memory: { write: noop, search: () => Promise.resolve([]), get: noopGet, update: noop, expire: noop, delete: noop, list: noopList },
    promptLibrary: { list: () => Promise.resolve({ data: [], pagination: { page: 1, pageSize: 0, total: 0, totalPages: 0 } }), get: () => Promise.resolve({ item: null }), categories: () => Promise.resolve({ data: [], pagination: { page: 1, pageSize: 0, total: 0, totalPages: 0 } }) },
    ecommerceWorkflow: { templates: { list: () => Promise.resolve([]) }, create: noop, list: () => Promise.resolve([]), get: noopGet, update: noop, delete: noop, saveImage: noop, runStep: noop, cancelStep: noop, submitModules: noop, onStream: unsub },
    showcase: { generateSellingPoints: noop, generatePlan: noop, generateImages: noop, getTask: noop, listTasks: noopList, cancelTask: noop },
    db: { providers: { list: noopList, get: noopGet, create: noop, update: noop, delete: noop, addModel: noop, toggleEnabled: noop, fetchModels: noop }, generations: { list: noopList, delete: noop }, assistants: { list: noopList, get: noopGet, create: noop, update: noop, delete: noop }, workflows: { list: noopList, get: noopGet, create: noop, update: noop, delete: noop } },
    feedback: { submit: noop },
    system: { getStorageInfo: () => Promise.resolve({}), clearCache: noop, clearDatabase: noop, backupDatabase: noop, restoreDatabase: noop, listBackups: () => Promise.resolve([]), getCrashReporting: () => Promise.resolve(false), setCrashReporting: noop },
    juhePrompts: { status: noop, ensureKey: noop, list: () => Promise.resolve([]), get: noopGet, render: noop, renderPackage: noop, getDefaultVisionModel: noopGet, getDefaultLLMModel: noopGet },
    plugins: { list: noopList, activate: noop, deactivate: noop },
  }
  ;(window as unknown as { api: Record<string, unknown> }).api = api
}

// biome-ignore lint/suspicious/noExplicitAny: ignored using `--suppress`
const sentryDsn = (window as any).__SENTRY_DSN__
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: 'renderer'
  })
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { createIpcLogger } from './utils/ipc-logger'
import { routeTree } from './routeTree.gen'

// Initialize IPC logger in dev mode (wraps window.api)
createIpcLogger()
import './i18n'
import './styles/index.css'
import { ErrorFallback } from './components/ErrorFallback'
import EulaModal from './components/EulaModal'
import { ToastProvider } from './components/ui/toast'
import { useChatStore } from './stores/chat'
import { initNetworkListener } from './stores/network'
import { useProviderStore } from './stores/providers'

// ── Renderer Global Error Handlers ──
window.onerror = (message, source, lineno, colno, error) => {
  const msg = `[Renderer Error] ${message} at ${source}:${lineno}:${colno}`
  console.error(msg, error)
}

window.onunhandledrejection = (event) => {
  console.error('[Renderer Unhandled Rejection]', event.reason)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1
    }
  }
})

const router = createRouter({ routeTree, defaultPreload: 'intent' })
let appBootstrapPromise: Promise<void> | null = null

// Register router for TypeScript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// App component with initialization
function App() {
  useAppInit()
  const [eulaAccepted, setEulaAccepted] = useState<boolean | null>(null)

  // Check EULA acceptance on mount
  useEffect(() => {
    window.api.config
      .get<boolean>('eula_accepted')
      .then((accepted) => {
        setEulaAccepted(accepted === true)
      })
      .catch(() => {
        // If config read fails, show EULA by default
        setEulaAccepted(false)
      })
  }, [])

  // After EULA is accepted, check if server URL is configured
  useEffect(() => {
    if (!eulaAccepted) return
    window.api.config
      .get<string>('juheBaseUrl')
      .then((url) => {
        if (!url) {
          router.navigate({ to: '/settings' })
        }
      })
      .catch(() => {})
  }, [eulaAccepted])

  const handleEulaAccept = () => {
    window.api.config
      .set('eula_accepted', true)
      .then(() => {
        setEulaAccepted(true)
      })
      .catch(() => {
        // Even if setting fails, let user proceed
        setEulaAccepted(true)
      })
  }

  // Show loading until EULA check completes
  if (eulaAccepted === null) {
    return null
  }

  return (
    <>
      {!eulaAccepted && <EulaModal onAccept={handleEulaAccept} />}
      <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </>
  )
}

// App initialization hook - runs once on mount
function useAppInit() {
  useEffect(() => {
    const appStart = performance.now()

    // 初始化网络监听
    const cleanupNetwork = initNetworkListener()

    // 加载会话历史和 provider 配置
    if (!appBootstrapPromise) {
      appBootstrapPromise = (async () => {
        console.log(`[AppInit] ⏱️ App initialization started at ${appStart.toFixed(1)}ms`)
        try {
          const s1 = performance.now()
          await useChatStore.getState().loadSessions()
          const e1 = performance.now()
          console.log(`[AppInit] ⏱️ Sessions loaded at ${e1.toFixed(1)}ms (+${(e1 - s1).toFixed(1)}ms)`)
        } catch (err) {
          console.error('[AppInit] Failed to load sessions:', err)
        }
        try {
          const s2 = performance.now()
          await useProviderStore.getState().loadProviders()
          const e2 = performance.now()
          console.log(`[AppInit] ⏱️ Providers loaded at ${e2.toFixed(1)}ms (+${(e2 - s2).toFixed(1)}ms)`)
        } catch (err) {
          console.error('[AppInit] Failed to load providers:', err)
        }
        const totalEnd = performance.now()
        console.log(
          `[AppInit] ⏱️ Total initialization completed at ${totalEnd.toFixed(1)}ms (+${(totalEnd - appStart).toFixed(1)}ms from start)`
        )
      })().catch((err) => {
        console.error('[AppInit] Failed during bootstrap:', err)
      })
    }

    void appBootstrapPromise

    return () => {
      cleanupNetwork()
    }
  }, [])
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')
createRoot(rootEl).render(
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <App />
    </ToastProvider>
  </QueryClientProvider>
)
