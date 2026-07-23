import { Button, Dialog, DialogContent, Input } from '@cherrystudio/ui'
import { Loader, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'

interface LoginModalProps {
  open: boolean
}

export function LoginModal({ open }: LoginModalProps) {
  const { t } = useTranslation()
  const { login, isLoading, error, clearError } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [localError, setLocalError] = useState('')

  // Captcha state
  const [captchaId, setCaptchaId] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)

  // Load saved credentials on mount
  useEffect(() => {
    console.log('[Auth] Loading saved credentials...')
    window.api.auth.getCredentials().then((result: { data?: { username: string; password: string } | null }) => {
      if (result?.data) {
        setUsername(result.data.username)
        setPassword(result.data.password)
        setRemember(true)
        console.log('[Auth] Credentials loaded', { username: result.data.username })
      } else {
        console.log('[Auth] No saved credentials')
      }
    }).catch((err) => console.log('[Auth] Failed to load credentials', err))
  }, [])

  // Sync store error to local
  useEffect(() => {
    if (error) setLocalError(error)
  }, [error])

  const [captchaError, setCaptchaError] = useState('')

  // Fetch captcha from server
  const refreshCaptcha = useCallback(async () => {
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
        setCaptchaError('验证码服务不可用')
        console.warn('[Auth] Captcha unavailable: empty response')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '网络错误'
      setCaptchaError(msg)
      console.warn('[Auth] Captcha fetch error', msg)
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  // Fetch captcha on mount and after failed login
  useEffect(() => {
    refreshCaptcha()
  }, [refreshCaptcha])

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setLocalError(t('newapi.authRequired'))
      return
    }

    console.log('[Auth] Login attempt', { username: username.trim(), hasCaptcha: !!captchaId, captchaCode: captchaCode ? '***' : '' })
    setLocalError('')
    clearError()

    const success = await login(username.trim(), password, remember, captchaId || undefined, captchaCode || undefined)
    if (!success) {
      console.log('[Auth] Login failed, refreshing captcha')
      refreshCaptcha()
      setCaptchaCode('')
    } else {
      console.log('[Auth] Login success')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  const handleClose = () => {
    // Don't allow closing — user must authenticate
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        size='default'
        className='gap-6 max-h-[90vh] overflow-y-auto'
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className='flex flex-col items-center gap-2'>
          <div className='w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center'>
            <span className='text-white text-lg font-bold'>J</span>
          </div>
          <h2 className='text-xl font-semibold text-neutral-900 dark:text-neutral-100'>{t('newapi.authenticate')}</h2>
          <p className='text-sm text-muted-foreground text-center'>{t('newapi.authRequiredDesc')}</p>
        </div>

        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-2'>
            <label className='text-sm font-medium text-neutral-700 dark:text-neutral-300'>{t('newapi.account')}</label>
            <Input
              type='text'
              placeholder='username'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div className='flex flex-col gap-2'>
            <label className='text-sm font-medium text-neutral-700 dark:text-neutral-300'>{t('newapi.password')}</label>
            <Input
              type='password'
              placeholder='••••••••'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </div>

          {/* Captcha */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between'>
              <label className='text-sm font-medium text-neutral-700 dark:text-neutral-300'>验证码</label>
              {!captchaImage && !captchaLoading && (
                <span className='text-[10px] text-muted-foreground'>未配置验证码服务</span>
              )}
            </div>
            <div className='flex items-center gap-2'>
              <Input
                type='text'
                placeholder={captchaImage ? '请输入验证码' : '验证码未加载（可留空）'}
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className='flex-1'
              />
              <button
                type='button'
                onClick={refreshCaptcha}
                disabled={captchaLoading}
                className='h-10 w-20 rounded-md border border-border overflow-hidden flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 shrink-0'
                title='点击刷新验证码'
              >
                {captchaLoading ? (
                  <RefreshCw className='w-3.5 h-3.5 animate-spin text-muted-foreground' />
                ) : captchaImage ? (
                  <img src={captchaImage} alt='验证码' className='w-full h-full object-cover' />
                ) : (
                  <RefreshCw className='w-3.5 h-3.5 text-muted-foreground' />
                )}
              </button>
            </div>
            {captchaError && (
              <div className='text-[11px] text-amber-500 flex items-center gap-1'>
                <span>⚠</span>
                <span>{captchaError}</span>
                <button type='button' onClick={refreshCaptcha} className='underline hover:text-amber-600 ml-1'>重试</button>
              </div>
            )}
          </div>

          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className='w-4 h-4 rounded border-border text-neutral-900 focus:ring-neutral-900'
              disabled={isLoading}
            />
            <span className='text-sm text-muted-foreground'>{t('newapi.rememberMe')}</span>
          </label>

          {localError && (
            <div className='text-sm text-red-500 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-md'>{localError}</div>
          )}

          <Button
            type='button'
            className='w-full'
            variant='default'
            size='default'
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader className='size-4 animate-spin' />
                {t('common.loading')}
              </>
            ) : (
              t('newapi.login')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
