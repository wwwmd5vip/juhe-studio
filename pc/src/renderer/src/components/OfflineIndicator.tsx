import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNetworkStore } from '@/stores/network'

export function OfflineIndicator() {
  const { t } = useTranslation()
  const { isOnline, checkConnection } = useNetworkStore()
  const [isRetrying, setIsRetrying] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setVisible(true)
    } else {
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline])

  const handleRetry = async () => {
    setIsRetrying(true)
    await checkConnection()
    setIsRetrying(false)
  }

  if (!visible) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium shadow-md transition-colors duration-300 ${
        isOnline ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className='h-4 w-4' />
          <span>{t('network.connectionRestored')}</span>
        </>
      ) : (
        <>
          <WifiOff className='h-4 w-4' />
          <span>{t('network.offlineMessage')}</span>
          <button
            type='button'
            onClick={handleRetry}
            disabled={isRetrying}
            className='ml-2 inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30 disabled:opacity-60'
          >
            {isRetrying ? <Loader2 className='h-3 w-3 animate-spin' /> : <Wifi className='h-3 w-3' />}
            {isRetrying ? t('network.reconnecting') : t('network.checkConnection')}
          </button>
        </>
      )}
    </div>
  )
}
