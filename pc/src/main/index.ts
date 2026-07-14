import fs from 'node:fs'
import { join, sep } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { app } from 'electron'

// Protect against EPIPE crashes when stdout/stderr is unavailable
// (e.g., launched from Finder/Dock without an attached terminal).
// console.log/warn/error calls will silently drop output instead of throwing.
const stdoutWrite = process.stdout.write.bind(process.stdout)
process.stdout.write = function(chunk: any, encoding?: any, cb?: any) {
  try { return stdoutWrite(chunk, encoding, cb) } catch (e: any) {
    if (e.code === 'EPIPE') { if (typeof cb === 'function') cb(); return false }
    throw e
  }
}
const stderrWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = function(chunk: any, encoding?: any, cb?: any) {
  try { return stderrWrite(chunk, encoding, cb) } catch (e: any) {
    if (e.code === 'EPIPE') { if (typeof cb === 'function') cb(); return false }
    throw e
  }
}

// Load .env before any other code runs.
// Priority: user data dir (production override) > app bundle dir > project root (dev)
const envPaths = [
  join(app.getPath('userData'), '.env'),       // user-overridable (production)
  join(app.getAppPath(), '.env'),              // bundled default / dev project root
]
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    loadDotenv({ path: envPath })
    if (is.dev) { console.log('[Main] Loaded .env from:', envPath) }
  }
}
if (is.dev) { console.log('[Main] JUHE_API_URL:', process.env.JUHE_API_URL) }
console.log('[Main] app.getAppPath():', app.getAppPath())

import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { BrowserWindow, dialog, protocol, session, shell } from 'electron'

// Enable CDP in development for automated testing/screenshots
if (is.dev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

import windowStateKeeper from 'electron-window-state'
import icon from '../../resources/icon.png?asset'

// IPC handlers
import './ipc'

// Database migrations
import { runMigrations } from './db/migrate'
import { setChatMainWindow } from './ipc/chat'
import { setMainWindow as setComfyMainWindow } from './ipc/comfy'
import { setWorkflowMainWindow } from './ipc/ecommerce-workflow'
import { setMainWindow } from './ipc/generation'
import { setImageProcessWindow } from './ipc/image-processing'
import { setMainWindow as setVideoGenerationMainWindow } from './ipc/video-generation'
import { setAgentSquadMainWindow } from './services/agent-squad-executor'
import { initImageServer, closeImageServer } from './services/jimeng-generation'
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './shortcuts'
import store, { validateStore } from './stores/config'
// System features
import { createTray, destroyTray } from './tray'
import { checkForUpdates, initUpdater } from './updater'

// ── Global Error Handlers & Crash Recovery ──
const logDir = app.getPath('logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
const crashLog = join(logDir, 'crash.log')

// Crash counter to prevent infinite restart loops
const CRASH_FILE = join(app.getPath('userData'), 'crash-count.json')
const CRASH_WINDOW_MS = 60_000
const CRASH_THRESHOLD = 3

// Crash logging uses synchronous I/O intentionally — must complete before process exits
function logCrash(tag: string, err: Error) {
  const ts = new Date().toISOString()
  const msg = `[${ts}] [${tag}] ${err.stack || err.message || String(err)}\n`
  fs.appendFileSync(crashLog, msg)
}

function recordCrash() {
  const now = Date.now()
  let crashes: number[] = []
  try {
    if (fs.existsSync(CRASH_FILE)) {
      const data = JSON.parse(fs.readFileSync(CRASH_FILE, 'utf-8'))
      crashes = (data.timestamps || []).filter((t: number) => now - t < CRASH_WINDOW_MS)
    }
  } catch { /* corrupted file — start fresh */ }
  crashes.push(now)
  try {
    fs.writeFileSync(CRASH_FILE, JSON.stringify({ timestamps: crashes }))
  } catch { /* can't persist — best effort */ }
}

function shouldRecover(): boolean {
  try {
    if (fs.existsSync(CRASH_FILE)) {
      const data = JSON.parse(fs.readFileSync(CRASH_FILE, 'utf-8'))
      const recent = (data.timestamps || []).filter((t: number) => Date.now() - t < CRASH_WINDOW_MS)
      return recent.length >= CRASH_THRESHOLD
    }
  } catch { /* corrupted file — assume safe */ }
  return false
}

function clearCrashHistory() {
  try {
    fs.writeFileSync(CRASH_FILE, JSON.stringify({ timestamps: [] }))
  } catch { /* best effort */ }
}

/** Compare two semver strings. Returns -1, 0, or 1 like a comparator. */
function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map(Number)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}

process.on('uncaughtException', (error) => {
  logCrash('uncaughtException', error)
  recordCrash()
  if (shouldRecover()) {
    dialog.showErrorBox(
      '应用反复崩溃',
      `应用在短时间内多次崩溃，已停止自动重启。\n\n${error.message}\n\n详细信息已保存到：${crashLog}\n\n请检查配置或联系支持。`
    )
    app.exit(1)
  } else {
    dialog.showErrorBox(
      '应用崩溃',
      `发生未捕获的错误，应用将重新启动。\n\n${error.message}\n\n详细信息已保存到：${crashLog}`
    )
    app.relaunch()
    app.exit(1)
  }
})

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  logCrash('unhandledRejection', err)
  recordCrash()
  console.error('Unhandled Rejection:', err)
  if (shouldRecover()) {
    dialog.showErrorBox(
      '应用反复崩溃',
      `应用在短时间内多次崩溃，已停止自动重启。\n\n${err.message}\n\n详细信息已保存到：${crashLog}\n\n请检查配置或联系支持。`
    )
    app.exit(1)
  }
  // Single unhandled rejection: log but don't restart — non-fatal rejections are common.
  // Only repeated crashes within the window trigger a restart.
})

// Register custom protocol as privileged — bypasses CSP and allows fetch API
// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'juhe-image',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
])

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let splashSlowTimer: ReturnType<typeof setTimeout> | null = null
let isQuitting = false
// Renderer crash recovery with exponential backoff
let rendererCrashCount = 0
const MAX_RENDERER_CRASHES = 4

function createSplashWindow(): BrowserWindow {
  const splashHtml = `<!DOCTYPE html><html><head><meta charset='utf-8'><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { display:flex; align-items:center; justify-content:center; height:100vh; background:#1a1a2e; font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif; overflow:hidden; user-select:none; -webkit-app-region:drag; }
    .container { text-align:center; color:#e0e0e0; }
    .logo { width:64px; height:64px; margin:0 auto 24px; background:linear-gradient(135deg,#00f0ff,#7b2fff); border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:700; color:#fff; }
    h1 { font-size:22px; margin:0 0 8px; color:#00f0ff; font-weight:600; letter-spacing:2px; }
    .en { font-size:13px; color:#888; margin-bottom:32px; letter-spacing:1px; }
    .loader-wrap { position:relative; width:44px; height:44px; margin:0 auto; }
    .loader { width:44px; height:44px; border:3px solid rgba(255,255,255,0.08); border-top-color:#00f0ff; border-right-color:#7b2fff; border-radius:50%; animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .status { font-size:12px; color:#666; margin-top:24px; transition:color .3s; }
    .status.slow { color:#ff9f43; }
  </style></head><body>
    <div class='container'>
      <div class='logo'>聚</div>
      <h1>聚合创作引擎</h1>
      <p class='en'>Juhe Studio</p>
      <div class='loader-wrap'><div class='loader'></div></div>
      <p class='status' id='status'>正在启动...</p>
    </div>
  </body></html>`

  splashWindow = new BrowserWindow({
    width: 400,
    height: 380,
    frame: false,
    center: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)

  splashWindow.once('ready-to-show', () => {
    splashWindow?.show()
  })

  return splashWindow
}

function registerWindowShortcuts(window: BrowserWindow): void {
  optimizer.watchWindowShortcuts(window)

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.code !== 'F12') return
    event.preventDefault()
    if (window.webContents.isDevToolsOpened()) {
      window.webContents.closeDevTools()
    } else {
      window.webContents.openDevTools({ mode: 'undocked' })
    }
  })
}

function createWindow(): BrowserWindow {
  // Load the previous window state with fallback to defaults
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1400,
    defaultHeight: 900,
    file: 'window-state.json'
  })

  // Create the browser window
  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // sandbox: false is required because the preload script exposes ipcRenderer
      // via @electron-toolkit/preload. Enabling sandbox would require refactoring
      // all renderer IPC calls to use contextBridge-exposed methods only.
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Performance: limit background throttle
      backgroundThrottling: true,
      // Enable devtools only in development (F12 / Ctrl+Shift+I)
      devTools: !app.isPackaged || is.dev,
      // Local images are served via juhe-image:// custom protocol
      webSecurity: true
    }
  })

  // Manage window state
  mainWindowState.manage(mainWindow)

  // Set main window reference for generation progress推送
  setMainWindow(mainWindow)
  setVideoGenerationMainWindow(mainWindow)
  setComfyMainWindow(mainWindow)
  setImageProcessWindow(mainWindow)
  setChatMainWindow(mainWindow)
  setWorkflowMainWindow(mainWindow)
  setAgentSquadMainWindow(mainWindow)

  // ── Renderer crash recovery with exponential backoff ──
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Main] Render process gone: reason=${details.reason}, exitCode=${details.exitCode}`)
    // Only attempt reload on crashes/OOM — not on clean exits or intentional kills
    if (details.reason === 'crashed' || details.reason === 'oom' || details.reason === 'launch-failed') {
      rendererCrashCount++
      if (rendererCrashCount > MAX_RENDERER_CRASHES) {
        console.error(`[Main] Renderer crashed ${rendererCrashCount} times, giving up`)
        dialog.showErrorBox('错误', '渲染进程反复崩溃，请重启应用')
        app.quit()
        return
      }
      const delay = Math.min(1000 * Math.pow(2, rendererCrashCount - 1), 8000)
      console.error(`[Main] Renderer crashed (#${rendererCrashCount}), reloading in ${delay}ms`)
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const reloadPromise = is.dev && process.env.ELECTRON_RENDERER_URL
            ? mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
            : mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
          reloadPromise.catch(() => {
            mainWindow?.loadURL(
              `data:text/html,<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#eee"><div><h2>应用崩溃</h2><p>请重启应用</p></div></body></html>`
            )
          })
        }
      }, delay)
    }
  })

  // Reset crash counter on successful page load
  mainWindow.webContents.on('did-finish-load', () => {
    if (rendererCrashCount > 0) {
      console.log('[Main] Renderer loaded successfully, resetting crash counter')
      rendererCrashCount = 0
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[Main] Page load failed: ${errorCode} - ${errorDescription}`)
  })

  mainWindow.on('ready-to-show', () => {
    // Clear slow-startup timer
    if (splashSlowTimer) {
      clearTimeout(splashSlowTimer)
      splashSlowTimer = null
    }
    // Close splash and show main window
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow?.show()
    // Performance: clear startup memory after window shown
    if (!is.dev) {
      setTimeout(() => {
        mainWindow?.webContents?.send('app:startup-complete')
      }, 500)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Only open http/https URLs externally with domain allowlist validation
    if (details.url.startsWith('http://') || details.url.startsWith('https://')) {
      try {
        const parsed = new URL(details.url)
        const allowedHosts = ['github.com', 'juhe.studio', 'localhost', '127.0.0.1']
        const isAllowed = allowedHosts.some(
          (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
        )
        if (isAllowed) {
          shell.openExternal(details.url)
        } else {
          console.warn(`[Security] Blocked external URL: ${details.url}`)
        }
      } catch {
        console.warn(`[Security] Blocked malformed URL: ${details.url}`)
      }
    }
    return { action: 'deny' }
  })

  // Prevent the main window from navigating to external URLs
  // (defense-in-depth against potential renderer code injection)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow local URLs (file:// for production, localhost for dev, app:// for custom protocol)
    if (
      url.startsWith('file://') ||
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1') ||
      url.startsWith('app://')
    ) {
      return
    }
    console.warn(`[Security] Blocked main-window navigation to: ${url}`)
    event.preventDefault()
  })

  // Handle close button: hide window instead of quitting (macOS behavior)
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Performance: pause expensive operations when hidden
  mainWindow.on('hide', () => {
    mainWindow?.webContents.send('app:visibility-change', false)
  })
  mainWindow.on('show', () => {
    mainWindow?.webContents.send('app:visibility-change', true)
  })

  registerWindowShortcuts(mainWindow)

  // HMR for renderer base on electron-vite cli
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// App lifecycle
app.whenReady().then(async () => {
  // ── Sentry crash reporting (lazy-loaded to avoid accessing Electron APIs before ready) ──
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/electron/main')
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'production',
        release: app.getVersion()
      })
      console.log('[Main] Sentry initialized')
    } catch (err) {
      console.warn('[Main] Sentry init failed:', err)
    }
  }

  // Register custom protocol (must be inside whenReady)
  registerCustomProtocol()

  // Set Content-Security-Policy at the session level for defense-in-depth.
  // This complements the <meta> tag CSP in index.html with Chromium-level enforcement.
  // In dev mode, relax script-src to allow Vite HMR inline scripts and ws: for HMR WebSocket.
  const csp = is.dev
    ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: juhe-image: data: blob:; connect-src 'self' https: wss: ws:; font-src 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: juhe-image: data: blob:; connect-src 'self' https: wss:; font-src 'self'"
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  // Set app user model id for Windows
  electronApp.setAppUserModelId('com.juhe-studio.app')

  // Run migrations first, then restore queue state from DB
  try {
    // Validate store config early to catch corrupted settings file
    validateStore()
    await runMigrations()

    // DB integrity check using a separate readonly connection
    try {
      const { createClient } = await import('@libsql/client')
      const dbPath = join(app.getPath('userData'), 'app.db')
      const checkClient = createClient({ url: `file:${dbPath}` })
      const result = await checkClient.execute('PRAGMA quick_check')
      checkClient.close()
      if (result.rows.length > 0 && result.rows[0][0] !== 'ok') {
        console.warn('[App] DB integrity check failed:', result.rows)
        dialog.showErrorBox('数据库错误', '数据库完整性检查失败，建议从备份恢复')
      }
    } catch (e) {
      console.error('[App] DB integrity check error (non-fatal):', e)
    }

    // Check for version downgrade — warn if current version is older than last stored version
    const lastVersion = store.get('lastVersion') as string | undefined
    const currentVersion = app.getVersion()
    if (lastVersion && compareVersions(currentVersion, lastVersion) < 0) {
      dialog.showErrorBox(
        '版本降级警告',
        `检测到版本降级 (${lastVersion} → ${currentVersion})。\n降级可能导致数据不兼容，建议备份数据库后再继续。`
      )
    }
    store.set('lastVersion', currentVersion)

    // Restore generation tasks from DB after migrations
    const { loadGenerationsFromDb, cleanupTempImages, markMissingImageFiles } = await import(
      './services/generation'
    )
    const { restoreTasksToQueue } = await import('./services/queue')
    const tasks = await loadGenerationsFromDb()
    restoreTasksToQueue(tasks)

    // Mark generations whose image file is already gone (legacy mtime cleanup)
    // as failed so UI shows a clear state instead of waiting forever on 404.
    // Runs before cleanupTempImages so the next cleanup sees the up-to-date DB.
    markMissingImageFiles()

    // Clean up orphan images (referenced-files aware) on startup and hourly.
    cleanupTempImages()
    setInterval(() => cleanupTempImages(), 60 * 60 * 1000)

    // Recover any showcase tasks left running from a previous session
    const { recoverRunningTasksOnStartup } = await import('./services/ecommerce-showcase')
    await recoverRunningTasksOnStartup()
  } catch (err) {
    console.error('[App] Migration or queue restore failed:', err)
    dialog.showErrorBox(
      '启动失败',
      `数据库迁移失败，请从备份恢复后重启应用。\n\n错误: ${err instanceof Error ? err.message : String(err)}`
    )
    app.quit()
    return
  }

  // DB integrity check runs above on a separate readonly connection after migrations.

  // Show splash screen while loading
  const splash = createSplashWindow()

  splash.webContents.on('render-process-gone', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
    }
    splashWindow = null
    // Show main window if it exists, otherwise create it
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
    }
  })

  // If startup takes too long, update splash text
  splashSlowTimer = setTimeout(() => {
    if (splash && !splash.isDestroyed()) {
      splash.webContents.executeJavaScript(
        `const el = document.getElementById('status'); if (el) { el.textContent = '首次启动可能需要较长时间...'; el.classList.add('slow'); }`
      ).catch(() => {})
    }
  }, 10000)

  // Create main window
  const window = createWindow()

  // Initialize system tray
  createTray(window)

  // Register global shortcuts
  registerGlobalShortcuts(window)

  // Initialize image server for Jimeng reference images
  initImageServer()

  // Initialize auto updater
  initUpdater()

  // Check for updates after a short delay
  setTimeout(() => {
    checkForUpdates()
  }, 5000)

  // Clear crash history after successful startup (5-minute grace period)
  setTimeout(() => clearCrashHistory(), 300_000)

  app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.on('render-process-gone', (_event, _webContents, details) => {
    console.error(`[Main] Render process gone: reason=${details.reason}, exitCode=${details.exitCode}`)
  })
  // ── Quit / cleanup handlers (registered inside whenReady for Electron API safety) ──

  // Quit when all windows are closed, except on macOS
  app.on('window-all-closed', () => {
    unregisterGlobalShortcuts()
    destroyTray()
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // Cleanup before quit
  app.on('before-quit', () => {
    isQuitting = true
    unregisterGlobalShortcuts()
    destroyTray()
    closeImageServer()
    // Force close all windows to prevent Electron process lingering
    BrowserWindow.getAllWindows().forEach((win) => {
      win.destroy()
    })
  })
})

// Performance: garbage collection hint on idle
app.on('browser-window-blur', () => {
  if (mainWindow && !is.dev) {
    // Suggest GC when window loses focus (if exposed)
    if (global.gc) {
      setTimeout(() => global.gc?.(), 5000)
    }
  }
})

// Prevent multiple instances (safe to call before ready)
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// Register custom protocol for serving local generated images.
// Must be called inside whenReady() — protocol.handle() accesses session internals.
function registerCustomProtocol(): void {
  protocol.handle('juhe-image', (request) => {
    // Robustly extract the file path: custom protocol URLs may arrive as
    // juhe-image:///Users/... (correct) or juhe-image://Users/... (host parsed as path segment).
    let filePath = decodeURIComponent(request.url.slice('juhe-image://'.length))
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath
    }

    // Resolve to prevent path traversal (e.g. ../../.ssh/id_rsa)
    const resolvedPath = require('node:path').resolve(filePath)
    const userDataPath = app.getPath('userData')
    // Append separator to prevent prefix bypass attacks:
    // e.g. userDataPath="/App/juhe-studio" would match "/App/juhe-studio-evil/foo"
    const normalizedDataPath = userDataPath.endsWith(sep)
      ? userDataPath
      : userDataPath + sep
    const allowed = resolvedPath.toLowerCase().startsWith(normalizedDataPath.toLowerCase())
    console.log('[Protocol]', allowed ? 'OK' : 'FORBIDDEN', '|', resolvedPath)

    if (!allowed) {
      return new Response('Forbidden', { status: 403 })
    }
    try {
      const data = fs.readFileSync(resolvedPath)
      const ext = resolvedPath.split('.').pop()?.toLowerCase()
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
      return new Response(data, {
        headers: { 'content-type': mimeType, 'cache-control': 'public, max-age=31536000' }
      })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  })
}
