import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '../stores/authStore'

export interface WsEvent {
  type: string
  data: Record<string, unknown>
  timestamp?: number
}

export interface NotificationItem {
  id: string
  type: string
  message: string
  time: number
}

type EventHandler = (event: WsEvent) => void

function buildNotificationMessage(event: WsEvent): string {
  const d = event.data as Record<string, unknown>
  switch (event.type) {
    case 'channel.auto_banned':
      return `渠道 "${d.channel_name}" (#${d.channel_id}) 连续失败 ${d.consecutive_failures} 次，已自动禁用`
    case 'channel.offline':
      return `渠道 "${d.channel_name}" (#${d.channel_id}) 连接失败`
    case 'health.failing':
      return `渠道连续探测失败: ${d.message}`
    case 'quota.low':
      return `剩余额度 ${((d.remaining_quota as number) / 100).toFixed(2)} 元，建议及时充值`
    default:
      return (d.message as string) || event.type
  }
}

export function useWebSocket(onEvent?: EventHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reconnectDisabledRef = useRef(false)
  const connectRef = useRef<() => void>(() => {})
  const retryCountRef = useRef(0)
  const token = useAuthStore(s => s.token)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const connect = useCallback(() => {
    reconnectDisabledRef.current = false
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/ws`)

    ws.onopen = () => {
      retryCountRef.current = 0
      // Send auth token as first message
      ws.send(JSON.stringify({ type: 'auth', token }))
    }

    ws.onmessage = (event) => {
      try {
        const parsed: WsEvent = JSON.parse(event.data)

        // Handle event history
        if (parsed.type === 'event.history') {
          const historyEvents = parsed.data as unknown as WsEvent[]
          if (Array.isArray(historyEvents)) {
            const historyNotifications: NotificationItem[] = historyEvents
              .filter((e) => e.type !== 'event.history' && e.type !== 'server.shutdown')
              .map((e) => ({
                id: `${e.type}-${e.timestamp || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: e.type,
                message: buildNotificationMessage(e),
                time: e.timestamp || Date.now(),
              }))
            setNotifications(historyNotifications)
          }
          return
        }

        // Handle server shutdown
        if (parsed.type === 'server.shutdown') {
          reconnectDisabledRef.current = true
        }

        // Add to notification list (skip history and shutdown)
        if (parsed.type !== 'server.shutdown') {
          const notificationMsg = buildNotificationMessage(parsed)
          const notification: NotificationItem = {
            id: `${parsed.type}-${parsed.timestamp || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: parsed.type,
            message: notificationMsg,
            time: parsed.timestamp || Date.now(),
          }
          setNotifications((prev) => [notification, ...prev].slice(0, 100))
          setUnreadCount((prev) => prev + 1)
        }

        onEvent?.(parsed)
      } catch { /* ignore malformed messages */ }
    }

    ws.onclose = (event) => {
      // Ignore close events from stale connections (race condition with cleanup)
      if (wsRef.current !== ws) return
      // Stop reconnecting on permanent failures (auth, policy, etc.)
      if (event.code >= 4000) {
        reconnectDisabledRef.current = true
        return
      }
      if (!reconnectDisabledRef.current) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 60000)
        retryCountRef.current++
        reconnectTimer.current = setTimeout(() => connectRef.current(), delay + Math.random() * 1000)
      }
    }

    ws.onerror = () => {
      if (wsRef.current !== ws) return
      // Don't call ws.close() here — the browser will fire onclose automatically
      // after an error, and calling close() explicitly causes double-cleanup.
    }

    wsRef.current = ws
  }, [token, onEvent])

  // Keep connectRef in sync
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      reconnectDisabledRef.current = true
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const clearUnread = useCallback(() => {
    setUnreadCount(0)
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  return { wsRef, notifications, unreadCount, clearUnread, clearAllNotifications }
}
