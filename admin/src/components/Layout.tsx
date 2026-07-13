import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { Layout as AntLayout, Menu, Button, Tooltip, Modal, App, Badge, Popover, List, Typography, Breadcrumb, theme as antdTheme } from 'antd'
import { pagePreloadMap } from '../pages/registry'
import {
  DashboardOutlined,
  UserOutlined,
  ClusterOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  DollarOutlined,
  KeyOutlined,
  WalletOutlined,
  GiftOutlined,
  BarChartOutlined,
  TransactionOutlined,
  FileSearchOutlined,
  ContainerOutlined,
  CrownOutlined,
  IdcardOutlined,
  SettingOutlined,
  SunOutlined,
  MoonOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ApiOutlined,
  AuditOutlined,
  HeartOutlined,
  ExperimentOutlined,
  SendOutlined,
  BellOutlined,
  MessageOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { FinanceProvider, useFinanceContext } from '../contexts/FinanceContext'
import { UserFinanceTab } from './UserFinanceTab'
import ErrorBoundary from './ErrorBoundary'

const { Header, Sider, Content } = AntLayout
const { Text } = Typography

const breadcrumbMap: Record<string, string> = {
  '/admin': '仪表盘',
  '/users': '用户管理',
  '/admin/tokens': 'Token 管理',
  '/channels': '渠道管理',
  '/models': '模型管理',
  '/pricing': '定价管理',
  '/tokens': 'Token',
  '/recharge': '在线充值',
  '/prompts': '提示词管理',
  '/daily-bills': '日账单',
  '/quota-transactions': '额度流水',
  '/topups': '充值订单',
  '/redemptions': '兑换码',
  '/quota-packages': '额度包',
  '/subscriptions': '订阅套餐',
  '/vendors': '厂商管理',
  '/releases': '版本管理',
  '/logs': '消费日志',
  '/audit-logs': '审计日志',
  '/settings': '系统设置',
  '/system-health': '系统健康',
  '/playground': '模型试用',
  '/feedbacks': '用户反馈',
  '/billing': '账单',
  '/profile': '个人中心',
  '/dashboard': '控制台',
}

const userMenuItems = [
  {
    key: 'group-user',
    type: 'group' as const,
    label: '工作台',
    children: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '控制台' },
      { key: '/tokens', icon: <KeyOutlined />, label: '我的 Key' },
      { key: '/recharge', icon: <WalletOutlined />, label: '充值' },
      { key: '/billing', icon: <BarChartOutlined />, label: '账单' },
    ],
  },
  {
    key: 'group-user-settings',
    type: 'group' as const,
    label: '设置',
    children: [
      { key: '/profile', icon: <IdcardOutlined />, label: '个人中心' },
    ],
  },
]

const menuItems = [
  {
    key: 'group-overview',
    type: 'group' as const,
    label: '概览',
    children: [
      { key: '/admin', icon: <DashboardOutlined />, label: '仪表盘' },
      { key: '/users', icon: <UserOutlined />, label: '用户管理' },
      { key: '/admin/tokens', icon: <KeyOutlined />, label: 'Token 管理' },
      { key: '/api-docs', icon: <ApiOutlined />, label: 'API 文档' },
    ],
  },
  {
    key: 'group-resources',
    type: 'group' as const,
    label: '核心资源',
    children: [
      { key: '/channels', icon: <ClusterOutlined />, label: '渠道管理' },
      { key: '/models', icon: <ApartmentOutlined />, label: '模型管理' },
      { key: '/pricing', icon: <DollarOutlined />, label: '定价管理' },
      { key: '/tokens', icon: <KeyOutlined />, label: 'Token' },
      { key: '/recharge', icon: <WalletOutlined />, label: '在线充值' },
    ],
  },
  {
    key: 'group-content',
    type: 'group' as const,
    label: '内容管理',
    children: [
      { key: '/prompts', icon: <FileTextOutlined />, label: '提示词管理' },
    ],
  },
  {
    key: 'group-billing',
    type: 'group' as const,
    label: '财务',
    children: [
      { key: '/daily-bills', icon: <BarChartOutlined />, label: '日账单' },
      { key: '/quota-transactions', icon: <TransactionOutlined />, label: '额度流水' },
      { key: '/topups', icon: <WalletOutlined />, label: '充值订单' },
      { key: '/redemptions', icon: <GiftOutlined />, label: '兑换码' },
      { key: '/quota-packages', icon: <ContainerOutlined />, label: '额度包' },
      { key: '/subscriptions', icon: <CrownOutlined />, label: '订阅套餐' },
    ],
  },
  {
    key: 'group-monitor',
    type: 'group' as const,
    label: '监控日志',
    children: [
      { key: '/logs', icon: <FileSearchOutlined />, label: '消费日志' },
      {
        key: '/audit-logs',
        icon: <AuditOutlined />,
        label: '审计日志',
      },
      { key: '/feedbacks', icon: <MessageOutlined />, label: '用户反馈' },
    ],
  },
  {
    key: 'group-settings',
    type: 'group' as const,
    label: '系统管理',
    children: [
      { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
      {
        key: '/system-health',
        icon: <HeartOutlined />,
        label: '系统健康',
      },
      { key: '/playground', icon: <ExperimentOutlined />, label: '模型试用' },
      { key: '/releases', icon: <SendOutlined />, label: '版本管理' },
      { key: '/profile', icon: <IdcardOutlined />, label: '个人中心' },
    ],
  },
]

function getRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

function getEventColor(type: string): string {
  switch (type) {
    case 'channel.auto_banned':
    case 'quota.low':
      return '#faad14'
    case 'channel.offline':
    case 'health.failing':
      return '#ff4d4f'
    default:
      return '#1677ff'
  }
}

function getEventIcon(type: string): string {
  switch (type) {
    case 'channel.auto_banned':
      return '⚠️'
    case 'channel.offline':
      return '🔴'
    case 'health.failing':
      return '💔'
    case 'quota.low':
      return '💰'
    default:
      return '📢'
  }
}

function FinanceDrawer() {
  const { selectedUserId, isOpen, closeFinanceDrawer } = useFinanceContext()
  return (
    <Modal
      title="用户财务概览"
      open={isOpen}
      onCancel={closeFinanceDrawer}
      width={800}
      footer={null}
      destroyOnClose
    >
      {selectedUserId !== null && <UserFinanceTab userId={selectedUserId} onViewAllTransactions={() => {}} />}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Preload groups – when the user lands on one route, eagerly load sibling pages
// so navigating within the same group feels instant.
// ---------------------------------------------------------------------------
const USER_PRELOAD_ROUTES = ['/tokens', '/recharge', '/billing', '/profile']
const ADMIN_OVERVIEW_ROUTES = ['/users', '/channels', '/admin/tokens']
const ADMIN_BILLING_ROUTES = ['/daily-bills', '/quota-transactions', '/topups', '/redemptions', '/quota-packages', '/subscriptions']
const ADMIN_MONITOR_ROUTES = ['/logs', '/audit-logs', '/feedbacks']
const ADMIN_SYSTEM_ROUTES = ['/settings', '/system-health', '/releases']
const ADMIN_CONFIG_ROUTES = ['/models', '/pricing', '/prompts', '/vendors', '/playground']

function usePagePreload(currentPath: string) {
  const preloaded = useRef(new Set<string>())

  const maybePreload = useCallback((routes: string[]) => {
    for (const route of routes) {
      if (preloaded.current.has(route)) continue
      const preloadFn = pagePreloadMap[route]
      if (preloadFn) {
        preloaded.current.add(route)
        // Fire-and-forget – the module cache handles dedup
        preloadFn()
      }
    }
  }, [])

  useEffect(() => {
    // Preload siblings based on the current route
    if (currentPath === '/dashboard') {
      maybePreload(USER_PRELOAD_ROUTES)
    } else if (currentPath === '/admin') {
      maybePreload(ADMIN_OVERVIEW_ROUTES)
      maybePreload(['/daily-bills', '/logs', '/settings'])
    } else if (USER_PRELOAD_ROUTES.includes(currentPath)) {
      maybePreload(USER_PRELOAD_ROUTES.filter((r) => r !== currentPath))
    } else if (ADMIN_OVERVIEW_ROUTES.includes(currentPath)) {
      maybePreload(ADMIN_OVERVIEW_ROUTES.filter((r) => r !== currentPath))
    } else if (ADMIN_BILLING_ROUTES.includes(currentPath)) {
      maybePreload(ADMIN_BILLING_ROUTES.filter((r) => r !== currentPath))
    } else if (ADMIN_MONITOR_ROUTES.includes(currentPath)) {
      maybePreload(ADMIN_MONITOR_ROUTES.filter((r) => r !== currentPath))
    } else if (ADMIN_SYSTEM_ROUTES.includes(currentPath)) {
      maybePreload(ADMIN_SYSTEM_ROUTES.filter((r) => r !== currentPath))
    } else if (ADMIN_CONFIG_ROUTES.includes(currentPath)) {
      maybePreload(ADMIN_CONFIG_ROUTES.filter((r) => r !== currentPath))
    }
  }, [currentPath, maybePreload])
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const username = useAuthStore((s) => s.user?.username || 'Admin')
  const role = useAuthStore((s) => s.user?.role ?? 0)
  const isAdmin = role >= 10
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'
  const { token } = antdTheme.useToken()
  const [collapsed, setCollapsed] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)

  // Preload sibling pages when route changes
  usePagePreload(location.pathname)

  // Ctrl+B / Cmd+B 切换侧边栏
  useKeyboardShortcuts([
    { key: 'b', ctrl: true, handler: () => setCollapsed((prev) => !prev) },
  ])

  const { notification } = App.useApp()
  const onWsEvent = useCallback((event: { type: string; data: Record<string, unknown> }) => {
    switch (event.type) {
      case 'channel.auto_banned':
        notification.warning({
          message: '渠道自动封禁',
          description: `渠道 "${event.data.channel_name}" (#${event.data.channel_id}) 连续失败 ${event.data.consecutive_failures} 次，已自动禁用`,
          duration: 8,
        })
        break
      case 'channel.offline':
        notification.error({
          message: '渠道离线',
          description: `渠道 "${event.data.channel_name}" (#${event.data.channel_id}) 连接失败`,
          duration: 6,
        })
        break
      case 'health.failing':
        notification.warning({
          message: '健康检查异常',
          description: `渠道连续探测失败: ${event.data.message}`,
          duration: 6,
        })
        break
      case 'quota.low':
        notification.warning({
          message: '额度不足提醒',
          description: `剩余额度 ${((event.data.remaining_quota as number) / 100).toFixed(2)} 元，建议及时充值`,
          duration: 10,
          btn: (
            <Button size="small" onClick={() => navigate('/recharge')}>
              去充值
            </Button>
          ),
        })
        break
    }
  }, [notification, navigate])

  const { notifications, unreadCount, clearUnread, clearAllNotifications } = useWebSocket(onWsEvent)

  // Filter menu based on role: admins see all, regular users see limited set
  const visibleItems = isAdmin ? menuItems : userMenuItems

  // Breadcrumb items from pathname
  const breadcrumbItems = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean)
    const items: { title: React.ReactNode; href?: string }[] = [{ title: <Link to="/">首页</Link> }]
    if (pathParts.length > 0) {
      let currentPath = ''
      for (const part of pathParts) {
        currentPath += '/' + part
        const label = breadcrumbMap[currentPath] || part
        items.push({ title: <Link to={currentPath}>{label}</Link> })
      }
    }
    return items
  }, [location.pathname])

  // Notification popover content
  const notificationContent = (
    <div style={{ maxHeight: 400, overflow: 'auto', width: 360 }}>
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: token.colorTextTertiary }}>
          <Text type="secondary">暂无通知</Text>
        </div>
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>
                  {getEventIcon(item.type)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, color: getEventColor(item.type) }}>
                    {item.message}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {getRelativeTime(item.time)}
                  </Text>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  )

  return (
    <FinanceProvider>
      <AntLayout style={{ minHeight: '100vh' }}>
        <Sider
          theme={isDark ? 'dark' : 'light'}
          collapsible
          collapsed={collapsed}
          trigger={null}
          breakpoint="lg"
          onBreakpoint={(broken) => setCollapsed(broken)}
          style={{ overflow: 'auto' }}
        >
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: collapsed
                ? 'transparent'
                : isDark
                  ? 'linear-gradient(135deg, #4a4dc2 0%, #5a3d8a 100%)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              transition: 'all 0.3s',
            }}
          >
            <DashboardOutlined style={{ fontSize: collapsed ? 20 : 24, color: '#fff', marginRight: collapsed ? 0 : 8 }} />
            {!collapsed && <span style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>Juhe Admin</span>}
          </div>

          <Menu
            theme={isDark ? 'dark' : 'light'}
            mode="inline"
            selectedKeys={[location.pathname]}
            items={visibleItems}
            onClick={({ key }) => {
              if (key === '/api-docs') {
                window.open('/api/swagger/index.html', '_blank')
                return
              }
              navigate(key)
            }}
          />
	      </Sider>
	      <AntLayout>
          <Header
            style={{
              background: isDark ? '#141414' : '#fff',
              padding: '0 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid',
              borderColor: isDark ? '#303030' : '#f0f0f0',
            }}
          >
            <Tooltip title={collapsed ? '展开菜单' : '折叠菜单'}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: 16, width: 40, height: 40 }}
                aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
              />
            </Tooltip>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, color: isDark ? '#e0e0e0' : '#333' }}>
                {username}
              </span>
              <Tooltip title={isDark ? '浅色模式' : '深色模式'}>
                <Button
                  type="text"
                  icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                  onClick={toggleTheme}
                  style={{ fontSize: 16, width: 32, height: 32 }}
                  aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
                />
              </Tooltip>
              <Popover
                content={notificationContent}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>通知中心</span>
                    {notifications.length > 0 && (
                      <Button
                        type="link"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={clearAllNotifications}
                      >
                        全部已读
                      </Button>
                    )}
                  </div>
                }
                trigger="click"
                open={bellOpen}
                onOpenChange={(open) => {
                  setBellOpen(open)
                  if (open) clearUnread()
                }}
                placement="bottomRight"
              >
                <Badge count={unreadCount} size="small" offset={[-4, 4]}>
                  <Button
                    type="text"
                    icon={<BellOutlined />}
                    style={{ fontSize: 16, width: 40, height: 40 }}
                    aria-label="通知中心"
                  />
                </Badge>
              </Popover>
              <Button onClick={() => { logout(); navigate('/login') }}>退出</Button>
            </div>
          </Header>
          <Content
            style={{
              margin: 12,
              padding: 16,
              background: isDark ? '#141414' : '#fff',
              borderRadius: 8,
              minHeight: 280,
            }}
          >
            <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 12 }} />
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </Content>
        </AntLayout>
      </AntLayout>
      <FinanceDrawer />
    </FinanceProvider>
  )
}
