import { Loader, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { ErrorFallback } from '@/components/ErrorFallback'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { ShortcutsHelp } from '@/components/ShortcutsHelp'
import { AnimatedPage } from '@/components/ui/AnimatedPage'
import { useAuthStore } from '@/stores/auth'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  // Check auth once on mount (background — does not block rendering)
  useEffect(() => {
    checkAuth()
  }, [checkAuth])  

  const toggleHelp = useCallback(() => {
    setHelpOpen((prev) => !prev)
  }, [])

  useEffect(() => {
    const handler = () => toggleHelp()
    window.addEventListener('shortcut:toggle-help', handler)
    return () => window.removeEventListener('shortcut:toggle-help', handler)
  }, [toggleHelp])

  // Not authenticated — show login form (always visible immediately)
  if (!isAuthenticated) {
    return <LoginOverlay isLoading={isLoading} />
  }

  // Authenticated — normal layout
  return (
    <div className='h-screen flex flex-col bg-[var(--juhe-void-2)] text-[var(--juhe-text)] overflow-hidden'>
      <OfflineIndicator />
      <TitleBar />
      <div className='flex-1 flex overflow-hidden'>
        <Sidebar />
        <main className='flex-1 overflow-auto'>
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            <AnimatedPage>{children}</AnimatedPage>
          </ErrorBoundary>
        </main>
      </div>
      <ShortcutsHelp isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

// Inline login overlay
function LoginOverlay({ isLoading }: { isLoading: boolean }) {
  const { t } = useTranslation()
  const { login, error, clearError } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [localError, setLocalError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // Captcha state
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [captchaError, setCaptchaError] = useState('')

  // Load saved credentials on mount
  useEffect(() => {
    console.log('[Auth] Loading saved credentials...')
    if (window.api?.auth?.getCredentials) {
      window.api.auth
        .getCredentials()
        .then((result: { data?: { username: string; password: string } | null }) => {
          if (result?.data) {
            setUsername(result.data.username)
            setPassword(result.data.password)
            setRemember(true)
            console.log('[Auth] Credentials loaded')
          } else {
            console.log('[Auth] No saved credentials')
          }
        })
        .catch((err: unknown) => console.log('[Auth] Failed to load credentials', err))
    }
  }, [])

  // Fetch captcha from server (with dedup guard)
  const captchaRef = useRef(false)
  const refreshCaptcha = useCallback(async () => {
    if (captchaRef.current) return // prevent concurrent fetches
    captchaRef.current = true
    console.log('[Auth] Fetching captcha...')
    setCaptchaLoading(true)
    setCaptchaError('')
    try {
      const result = await window.api.auth.getCaptcha() as { data?: { captcha_id: string; image: string } }
      if (result?.data) {
        setCaptchaId(result.data.captcha_id)
        setCaptchaImage(result.data.image)
        console.log('[Auth] Captcha fetched', { captchaId: result.data.captcha_id })
      } else {
        setCaptchaError(t('newapi.captchaUnavailable'))
        console.warn('[Auth] Captcha unavailable: empty response')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('newapi.captchaNetworkError')
      setCaptchaError(msg)
      console.warn('[Auth] Captcha fetch error', msg)
    } finally {
      setCaptchaLoading(false)
      captchaRef.current = false
    }
  }, [])

  // Fetch captcha on mount (once)
  useEffect(() => {
    refreshCaptcha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (error) setLocalError(error)
  }, [error])

  const handleLogin = async () => {
    if (loggingIn) return // prevent double submit
    if (!username.trim() || !password.trim()) {
      setLocalError(t('newapi.authRequired'))
      return
    }
    console.log('[Auth] Login attempt', { username: username.trim(), hasCaptcha: !!captchaId })
    setLocalError('')
    clearError()
    setLoggingIn(true)
    try {
      const success = await login(username.trim(), password, remember, captchaId || undefined, captchaCode || undefined)
      if (!success) {
        // Refresh captcha after failed login
        refreshCaptcha()
        setCaptchaCode('')
      }
    } finally {
      setLoggingIn(false)
    }
  }

  // Refresh captcha when login error message changes (server-side captcha error)
  const prevError = useRef(error)
  useEffect(() => {
    if (error && error !== prevError.current) {
      refreshCaptcha()
      setCaptchaCode('')
    }
    prevError.current = error
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  const isBusy = loggingIn || isLoading

  return (
    <div className='h-screen flex items-center justify-center bg-[var(--juhe-void-2)]'>
      <div
        className='w-full max-w-sm mx-4 p-8 rounded-2xl bg-[var(--juhe-surface)] border border-[rgba(255,255,255,0.1)]'
      >
        <div className='flex flex-col items-center gap-3 mb-8'>
          <div className='w-12 h-12 rounded-xl bg-neutral-200 flex items-center justify-center'>
            <span className='text-neutral-900 text-lg font-bold'>J</span>
          </div>
          <h2 className='text-xl font-semibold text-[var(--juhe-text)]'>
            {t('newapi.authenticate')}
          </h2>
          <p className='text-sm text-center text-[var(--juhe-text-3)]'>
            {t('newapi.authRequiredDesc')}
          </p>
        </div>

        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <label className='text-xs font-medium text-[var(--juhe-text-2)]'>
              {t('newapi.account')}
            </label>
            <input
              type='text'
              placeholder='username'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              className='h-10 px-3 rounded-lg text-sm outline-none transition-colors bg-[var(--juhe-void-2)] border border-[rgba(255,255,255,0.1)] text-[var(--juhe-text)]'
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <label className='text-xs font-medium text-[var(--juhe-text-2)]'>
              {t('newapi.password')}
            </label>
            <input
              type='password'
              placeholder='••••••••'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              className='h-10 px-3 rounded-lg text-sm outline-none transition-colors bg-[var(--juhe-void-2)] border border-[rgba(255,255,255,0.1)] text-[var(--juhe-text)]'
            />
          </div>

          {/* Captcha */}
          <div className='flex flex-col gap-1.5'>
            <div className='flex items-center justify-between'>
              <label className='text-xs font-medium text-[var(--juhe-text-2)]'>{t('newapi.captcha')}</label>
              {!captchaImage && !captchaLoading && (
                <span className='text-[10px] text-[var(--juhe-text-3)]'>{t('newapi.captchaRefresh')}</span>
              )}
            </div>
            <div className='flex items-center gap-2'>
              <input
                type='text'
                placeholder={captchaImage ? t('newapi.captchaPlaceholder') : t('newapi.captchaOptional')}
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isBusy}
                className='h-10 flex-1 px-3 rounded-lg text-sm outline-none transition-colors bg-[var(--juhe-void-2)] border border-[rgba(255,255,255,0.1)] text-[var(--juhe-text)]'
              />
              <button
                type='button'
                onClick={refreshCaptcha}
                disabled={captchaLoading}
                className='h-10 w-20 rounded-lg border border-[rgba(255,255,255,0.1)] overflow-hidden flex items-center justify-center hover:bg-[var(--juhe-surface-2)] transition-colors disabled:opacity-50 shrink-0'
                title={t('newapi.captchaRefreshTitle')}
              >
                {captchaLoading ? (
                  <RefreshCw className='w-3.5 h-3.5 animate-spin text-[var(--juhe-text-3)]' />
                ) : captchaImage ? (
                  <img src={captchaImage} alt={t('newapi.captcha')} className='w-full h-full object-cover' />
                ) : (
                  <RefreshCw className='w-3.5 h-3.5 text-[var(--juhe-text-3)]' />
                )}
              </button>
            </div>
            {captchaError && (
              <div className='text-[10px] text-amber-500 flex items-center gap-1'>
                <span>⚠</span>
                <span>{captchaError}</span>
                <button type='button' onClick={refreshCaptcha} className='underline hover:text-amber-600 ml-1'>{t('newapi.retry')}</button>
              </div>
            )}
          </div>

          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={isBusy}
              className='w-4 h-4 rounded accent-neutral-600'
            />
            <span className='text-xs text-[var(--juhe-text-3)]'>
              {t('newapi.rememberMe')}
            </span>
          </label>

          {localError && (
            <div
              className='text-xs px-3 py-2 rounded-lg'
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            >
              {localError}
            </div>
          )}

          {/* Loading indicator when checking auth in background */}
          {isLoading && !loggingIn && (
            <div className='flex items-center justify-center gap-2 text-xs text-[var(--juhe-text-3)]'>
              <Loader className='size-3 animate-spin' />
              {t('common.loading')}
            </div>
          )}

          <button
            type='button'
            onClick={handleLogin}
            disabled={isBusy}
            className='h-10 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-[var(--juhe-text)] text-[var(--juhe-void-2)]'
          >
            {loggingIn ? (
              <>
                <Loader className='size-4 animate-spin' />
                {t('common.loading')}
              </>
            ) : (
              t('newapi.login')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
