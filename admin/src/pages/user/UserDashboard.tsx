import { useMemo } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Typography,
  Tag,
  Button,
  Space,
  Alert,
} from 'antd'
import {
  WalletOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  CrownOutlined,
  DollarOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

// ── Types matching relay API responses ──

interface QuotaInfo {
  quota: number
  used_quota: number
}

interface DailyBillInfo {
  id: number
  bill_date: string
  user_id: number
  model_name: string
  request_count: number
  token_count: number
  quota_consumed: number
  quota_recharged: number
}

interface UserSubscriptionInfo {
  id: number
  user_id: number
  plan_id: number
  status: number // 0=inactive, 1=active, 2=cancelled, 3=expired
  started_at: string
  expires_at: string
  last_billed_at?: string
}

interface SubscriptionPlanInfo {
  id: number
  name: string
  quota_value: number
  price_cents: number
  interval_months: number
  status: number
}

interface ApiResponse<T> {
  code: number
  message: string
  data?: T
}

interface PagedData<T> {
  data: T[]
  pagination: { total: number }
}

// ── Relay API helper (uses token from authStore) ──

function getAuthHeaders(): HeadersInit {
  const token = useAuthStore.getState().token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function relayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init?.headers as Record<string, string>) },
  })
  if (!res.ok) {
    throw new Error(`Relay API error: ${res.status} ${res.statusText}`)
  }
  const body: ApiResponse<T> = await res.json()
  if (body.code !== 0) {
    throw new Error(body.message || 'Unknown error')
  }
  return body.data as T
}

async function fetchQuota(): Promise<QuotaInfo> {
  return relayFetch<QuotaInfo>('/v1/quota')
}

async function fetchTodayUsage(): Promise<{ requests: number; tokens: number; quotaConsumed: number }> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const result = await relayFetch<PagedData<DailyBillInfo>>(
    `/v1/daily-bills?start_date=${today}&end_date=${today}&page=1&page_size=100`,
  )
  const items = result?.data ?? []
  return {
    requests: items.reduce((sum, b) => sum + (b.request_count || 0), 0),
    tokens: items.reduce((sum, b) => sum + (b.token_count || 0), 0),
    quotaConsumed: items.reduce((sum, b) => sum + (b.quota_consumed || 0), 0),
  }
}

async function fetchMySubscriptions(): Promise<UserSubscriptionInfo[]> {
  const result = await relayFetch<PagedData<UserSubscriptionInfo>>('/v1/subscriptions?page=1&page_size=50')
  return result?.data ?? []
}

async function fetchSubscriptionPlans(): Promise<SubscriptionPlanInfo[]> {
  const result = await relayFetch<PagedData<SubscriptionPlanInfo>>('/v1/subscription-plans?page=1&page_size=50')
  return result?.data ?? []
}

// ── Helpers ──

function formatNumber(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '-'
  if (value >= 10000) {
    const k = (value / 10000).toFixed(1)
    return `${k} 万`
  }
  return value.toLocaleString()
}

function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours()
  if (h < 6) return { text: '夜深了', emoji: '🌙' }
  if (h < 12) return { text: '早上好', emoji: '☀️' }
  if (h < 14) return { text: '中午好', emoji: '🌤️' }
  if (h < 18) return { text: '下午好', emoji: '🌻' }
  return { text: '晚上好', emoji: '🌆' }
}

function getDateLabel(): string {
  const now = new Date()
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]}`
}

// ── Quota Progress Color ──

function getQuotaColor(remain: number, total: number): string {
  const pct = total > 0 ? remain / total : 1
  if (pct <= 0.1) return '#ff4d4f'
  if (pct <= 0.3) return '#faad14'
  return '#1677ff'
}

const QUOTA_LOW_THRESHOLD = 1000 // 10 RMB in cents


interface QuotaForecastData {
  daily_avg_consumption: number
  remaining_quota: number
  estimated_days: number
  trend: string
}

async function fetchQuotaForecast(userId: number): Promise<QuotaForecastData | null> {
  try {
    const token = useAuthStore.getState().token
    const res = await fetch(`/api/dashboard/quota-forecast?user_id=${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (res.status === 401) {
      try { localStorage.removeItem('juhe_token') } catch { /* ignore */ }
      useAuthStore.getState().logout()
      return null
    }
    if (!res.ok) return null
    const body = await res.json()
    if (body.code !== 0) return null
    return body.data as QuotaForecastData
  } catch {
    return null
  }
}

// ── Component ──

export default function UserDashboard() {
  const navigate = useNavigate()
  const username = useAuthStore((s) => s.user?.username || '用户')
  const role = useAuthStore((s) => s.user?.role)
  const isAdmin = role != null && role >= 10

  // Quota
  const { data: quota, isLoading: quotaLoading, isError: quotaIsError, error: quotaError } = useQuery({
    queryKey: ['relay', 'quota'],
    queryFn: fetchQuota,
    staleTime: 30_000,
  })

  // Today usage
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const { data: todayUsage, isLoading: usageLoading } = useQuery({
    queryKey: ['relay', 'daily-bills', today],
    queryFn: fetchTodayUsage,
    staleTime: 60_000,
  })

  // Subscriptions
  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ['relay', 'subscriptions'],
    queryFn: fetchMySubscriptions,
    staleTime: 5 * 60_000,
  })

  const { data: plans } = useQuery({
    queryKey: ['relay', 'subscription-plans'],
    queryFn: fetchSubscriptionPlans,
    staleTime: 5 * 60_000,
    enabled: !!subscriptions && subscriptions.length > 0,
  })

  // Quota forecast
  const userId = useAuthStore((s) => s.user?.id || 0)
  const { data: forecast } = useQuery({
    queryKey: ['dashboard', 'quota-forecast', userId],
    queryFn: () => fetchQuotaForecast(userId),
    staleTime: 5 * 60_000,
    enabled: userId > 0,
  })


  // Derived
  const totalQuota = quota?.quota ?? 0
  const usedQuota = quota?.used_quota ?? 0
  const remainQuota = totalQuota - usedQuota
  const quotaPercent = totalQuota > 0 ? Math.round((remainQuota / totalQuota) * 100) : 100
  const quotaColor = getQuotaColor(remainQuota, totalQuota)

  const activeSub = subscriptions?.find((s) => s.status === 1)
  const planMap = useMemo(() => {
    const map = new Map<number, SubscriptionPlanInfo>()
    plans?.forEach((p) => map.set(p.id, p))
    return map
  }, [plans])

  const isLowQuota = totalQuota > 0 && remainQuota < QUOTA_LOW_THRESHOLD

  const greeting = useMemo(() => getGreeting(), [])

  if (quotaIsError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="加载失败"
          description={quotaError?.message || '额度数据加载失败，请稍后重试'}
          showIcon
        />
      </div>
    )
  }

  return (
    <div>
      <style>{`
        @keyframes juhe-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(255, 77, 79, 0); }
        }
        @keyframes juhe-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      {/* Hero Greeting */}
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {greeting.emoji} {greeting.text}，{username}
        </Typography.Title>
        <Typography.Text type="secondary">{getDateLabel()}</Typography.Text>
      </div>

      <Row gutter={[16, 16]}>
        {/* ── Quota Balance ── */}
        <Col xs={24} lg={12}>
          <Card
            loading={quotaLoading}
            style={{
              borderRadius: 12,
              background: isLowQuota
                ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              ...(isLowQuota ? { animation: 'juhe-pulse 2s ease-in-out infinite' } : {}),
            }}
          >
            <div style={{ opacity: 0.85, marginBottom: 4, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>额度余额</span>
              {isLowQuota && (
                <Tag
                  color="error"
                  style={{
                    animation: 'juhe-blink 1s step-end infinite',
                    margin: 0,
                  }}
                >
                  额度不足
                </Tag>
              )}
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>
              {formatNumber(remainQuota)}
              <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4, opacity: 0.75 }}>额度</span>
            </div>
            <Progress
              percent={quotaPercent}
              showInfo={false}
              strokeColor={quotaColor}
              trailColor="rgba(255,255,255,0.2)"
              size="small"
            />
            <Row style={{ marginTop: 8 }}>
              <Col span={12}>
                <Typography.Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                  已用 {formatNumber(usedQuota)}
                </Typography.Text>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Typography.Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                  总额 {formatNumber(totalQuota)}
                </Typography.Text>
              </Col>
            </Row>
          </Card>
            {/* ── Quota Forecast ── */}
            {forecast && (
              <Card style={{ borderRadius: 12, marginTop: 16 }} size="small">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    日平均消费: ¥{(forecast.daily_avg_consumption / 100).toFixed(2)}
                  </Typography.Text>
                  <Typography.Text
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: forecast.estimated_days < 7 ? '#ff4d4f' : '#52c41a',
                    }}
                  >
                    预计可用 {forecast.estimated_days >= 9999 ? '∞' : `${forecast.estimated_days} 天`}
                  </Typography.Text>
                </div>
                <Progress
                  percent={Math.min(100, Math.round(((forecast.daily_avg_consumption * 30) / Math.max(1, forecast.remaining_quota)) * 100))}
                  showInfo={false}
                  strokeColor={
                    forecast.estimated_days < 7
                      ? '#ff4d4f'
                      : forecast.estimated_days < 30
                        ? '#faad14'
                        : '#52c41a'
                  }
                  size="small"
                />
                <div style={{ marginTop: 8 }}>
                  <Tag
                    color={
                      forecast.trend === 'increasing'
                        ? 'red'
                        : forecast.trend === 'decreasing'
                          ? 'green'
                          : 'blue'
                    }
                  >
                    {forecast.trend === 'increasing'
                      ? '↑ 上升趋势'
                      : forecast.trend === 'decreasing'
                        ? '↓ 下降趋势'
                        : '→ 稳定'}
                  </Tag>
                </div>
              </Card>
            )}

        </Col>

        {/* ── Today Usage Stats ── */}
        <Col xs={24} lg={12}>
          <Card
            loading={usageLoading}
            style={{ borderRadius: 12 }}
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#1677ff' }} />
                <span>今日用量</span>
                <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  {today}
                </Typography.Text>
              </Space>
            }
          >
            <Row gutter={24}>
              <Col span={8}>
                <Statistic
                  title="请求数"
                  value={todayUsage?.requests ?? 0}
                  prefix={<ApiOutlined style={{ color: '#1677ff' }} />}
                  valueStyle={{ fontSize: 24 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Token"
                  value={formatNumber(todayUsage?.tokens ?? 0)}
                  prefix={<ThunderboltOutlined style={{ color: '#13c2c2' }} />}
                  valueStyle={{ fontSize: 24 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="消耗额度"
                  value={formatNumber(todayUsage?.quotaConsumed ?? 0)}
                  prefix={<DollarOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ fontSize: 24 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* ── Subscription Status ── */}
        <Col xs={24} lg={12}>
          <Card
            loading={subsLoading}
            style={{ borderRadius: 12 }}
            title={
              <Space>
                <CrownOutlined style={{ color: '#faad14' }} />
                <span>订阅状态</span>
              </Space>
            }
          >
            {activeSub ? (
              <Row align="middle" gutter={16}>
                <Col flex="auto">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="green">生效中</Tag>
                    <Typography.Text strong>
                      {planMap.get(activeSub.plan_id)?.name ?? `套餐 #${activeSub.plan_id}`}
                    </Typography.Text>
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    到期时间：{new Date(activeSub.expires_at).toLocaleDateString('zh-CN')}
                    {activeSub.last_billed_at
                      ? ` · 上次扣费：${new Date(activeSub.last_billed_at).toLocaleDateString('zh-CN')}`
                      : ''}
                  </Typography.Text>
                </Col>
                {isAdmin && (
                  <Col>
                    <Button size="small" onClick={() => navigate('/subscriptions')}>
                      管理
                    </Button>
                  </Col>
                )}
              </Row>
            ) : subscriptions && subscriptions.length > 0 ? (
              <Alert
                type="warning"
                message="暂无生效中的订阅"
                description={isAdmin ? '您的订阅已过期或已取消，可前往订阅页面查看详情。' : '您的订阅已过期或已取消。'}
                showIcon
                action={
                  isAdmin ? (
                    <Button size="small" onClick={() => navigate('/subscriptions')}>
                      查看
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#999' }}>
                <CrownOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
                <Typography.Text type="secondary">暂无订阅记录</Typography.Text>
                {isAdmin && (
                  <div style={{ marginTop: 12 }}>
                    <Button type="primary" size="small" onClick={() => navigate('/subscriptions')}>
                      开通订阅
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>

        {/* ── Quick Actions ── */}
        <Col xs={24} lg={12}>
          <Card
            style={{ borderRadius: 12 }}
            title={
              <Space>
                <WalletOutlined style={{ color: '#52c41a' }} />
                <span>快捷操作</span>
              </Space>
            }
          >
            <Space wrap size={12}>
              {isAdmin && (
                <>
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    size="large"
                    onClick={() => navigate('/topups')}
                  >
                    充值
                  </Button>
                  <Button
                    icon={<FileTextOutlined />}
                    size="large"
                    onClick={() => navigate('/daily-bills')}
                  >
                    账单
                  </Button>
                  <Button
                    icon={<WalletOutlined />}
                    size="large"
                    onClick={() => navigate('/quota-transactions')}
                  >
                    额度流水
                  </Button>
                </>
              )}
              <Button
                icon={<ApiOutlined />}
                size="large"
                onClick={() => navigate('/tokens')}
              >
                我的 Key
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
