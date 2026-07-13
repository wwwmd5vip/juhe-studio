import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Statistic, Space, Typography, Tag, Tooltip, Button, Table, Skeleton, Alert } from 'antd'
import {
  UserOutlined,
  KeyOutlined,
  ClusterOutlined,
  ApartmentOutlined,
  RiseOutlined,
  DollarOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  getDashboardStats,
  getDashboardTrends,
  getModelCapabilityStats,
  getUsageHeatmap,
  getTopUsers,
  getTopTokens,
  getErrorRate,
  getQuotaForecast,
} from '../../api/dashboard'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  Cell,
} from 'recharts'
import { useThemeStore } from '../../stores/themeStore'
import { useFinanceContext } from '../../contexts/FinanceContext'

function formatNumber(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '-'
  if (value >= 10000) {
    const k = (value / 10000).toFixed(1)
    return `${k} 万`
  }
  return value.toLocaleString()
}

function getElapsedMinutesToday(): number {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const elapsed = (now.getTime() - startOfDay.getTime()) / 60000
  return Math.max(elapsed, 1)
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

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  transition: 'all .3s',
}

const primaryCardStyle: React.CSSProperties = {
  ...cardStyle,
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: '#fff',
}

const REFRESH_INTERVAL = 30

export default function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [isVisible, setIsVisible] = useState(true)
  const { openFinanceDrawer } = useFinanceContext()

  // Priority tiers for deferred query loading
  const [enableTier2, setEnableTier2] = useState(false)
  const [enableTier3, setEnableTier3] = useState(false)

  // Track tab visibility — pause auto-refresh when hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Auto-refresh countdown: count 30 → 0 then refetch (paused when tab is hidden)
  useEffect(() => {
    if (!isVisible) return
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [isVisible])

  // Triggers dashboard refresh when countdown resets
  useEffect(() => {
    if (countdown === REFRESH_INTERVAL && isVisible) {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  }, [countdown, queryClient, isVisible])

  // Defer Tier 2 and Tier 3 queries to reduce initial request concurrency
  useEffect(() => {
    const t2 = setTimeout(() => setEnableTier2(true), 200)
    const t3 = setTimeout(() => setEnableTier3(true), 400)
    return () => {
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  // Tier 1: Immediate — overview cards + model capability distribution
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => getDashboardStats(),
  })

  const { data: capabilityData } = useQuery({
    queryKey: ['dashboard', 'model-capability-stats'],
    queryFn: () => getModelCapabilityStats(),
    staleTime: 5 * 60 * 1000,
  })

  // Tier 2: Deferred (200ms) — charts
  const { data: trendsData, isLoading: trendsLoading, isError: trendsIsError, error: trendsError } = useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: () => getDashboardTrends(30),
    staleTime: 5 * 60 * 1000,
    enabled: enableTier2,
  })

  const { data: heatmapData } = useQuery({
    queryKey: ['dashboard', 'usage-heatmap'],
    queryFn: () => getUsageHeatmap(7),
    staleTime: 5 * 60 * 1000,
    enabled: enableTier2,
  })

  const [errorRateView, setErrorRateView] = useState<'channels' | 'models'>('channels')

  const { data: errorRateData } = useQuery({
    queryKey: ['dashboard', 'error-rate'],
    queryFn: () => getErrorRate(7),
    staleTime: 5 * 60 * 1000,
    enabled: enableTier2,
  })

  // Tier 3: Lazy (400ms) — ranking tables
  const { data: topUsersData } = useQuery({
    queryKey: ['dashboard', 'top-users'],
    queryFn: () => getTopUsers(30, 10),
    staleTime: 5 * 60 * 1000,
    enabled: enableTier3,
  })

  const { data: topTokensData } = useQuery({
    queryKey: ['dashboard', 'top-tokens'],
    queryFn: () => getTopTokens(30, 10),
    staleTime: 5 * 60 * 1000,
    enabled: enableTier3,
  })

  // Quota forecast (Tier 3)
  const { data: forecastData } = useQuery({
    queryKey: ['dashboard', 'quota-forecast'],
    queryFn: () => getQuotaForecast(undefined, 30),
    staleTime: 5 * 60 * 1000,
    enabled: enableTier3,
  })

  const stats = data?.data
  const greeting = useMemo(() => getGreeting(), [])

  const totalActive = (stats?.active_channel_count ?? 0) > 0
  const quotaRatio = stats?.today_quota_recharged && stats?.today_quota_consumed
    ? stats.today_quota_consumed / Math.max(stats.today_quota_recharged, 1)
    : 0

  const healthColor = quotaRatio > 1 ? '#ff4d4f' : quotaRatio > 0.7 ? '#faad14' : '#52c41a'
  const healthLabel = quotaRatio > 1 ? '超额' : quotaRatio > 0.7 ? '偏高' : '健康'

  // RPM / TPM computed from today's totals divided by elapsed minutes
  const elapsedMin = getElapsedMinutesToday()
  const rpm = stats ? Math.round(stats.today_request_count / elapsedMin) : 0
  const tpm = stats ? Math.round(stats.today_token_count / elapsedMin) : 0

  const countdownPct = (countdown / REFRESH_INTERVAL) * 100

  const trends = trendsData?.data ?? []
  const chartData = trends.map((item) => ({
    date: item.date,
    requests: item.requests,
    quotaYuan: item.quota / 100,
  }))

  const CAPABILITY_LABEL_MAP: Record<string, string> = {
    'function-call': '函数调用',
    vision: '视觉',
    reasoning: '推理',
    'image-generation': '图像生成',
    'image-input': '图像输入',
    'audio-input': '音频输入',
    'audio-output': '音频输出',
    embedding: '嵌入',
    rerank: '重排序',
    'web-search': '联网搜索',
    'structured-output': '结构化输出',
    'video-input': '视频输入',
    'video-generation': '视频生成',
  }

  const capabilityStats = capabilityData?.data ?? {}
  const capabilityChartData = Object.entries(capabilityStats)
    .map(([key, value]) => ({
      capability: CAPABILITY_LABEL_MAP[key] ?? key,
      count: value,
    }))
    .sort((a, b) => b.count - a.count)

  // Heatmap processing
  const heatmapItems = heatmapData?.data ?? []
  const heatmapModels = [...new Set(heatmapItems.map((h) => h.model_name))].sort()
  const heatmapMatrix: Record<string, Record<number, number>> = {}
  for (const model of heatmapModels) {
    heatmapMatrix[model] = {}
    for (let h = 0; h < 24; h++) {
      heatmapMatrix[model][h] = 0
    }
  }
  for (const item of heatmapItems) {
    if (heatmapMatrix[item.model_name]) {
      heatmapMatrix[item.model_name][item.hour] = item.count
    }
  }
  const heatmapMaxCount = Math.max(1, ...heatmapItems.map((i) => i.count))

  const topUsers = topUsersData?.data ?? []
  const topTokens = topTokensData?.data ?? []

  // Day-over-day deltas (from trends)
  const yesterdayDelta = useMemo(() => {
    if (trends.length < 2) return { requests: 0, quota: 0 }
    const today = trends[trends.length - 1]
    const yesterday = trends[trends.length - 2]
    const reqDelta = yesterday.requests > 0
      ? ((today.requests - yesterday.requests) / yesterday.requests * 100)
      : 0
    const quotaDelta = yesterday.quota > 0
      ? ((today.quota - yesterday.quota) / yesterday.quota * 100)
      : 0
    return { requests: reqDelta, quota: quotaDelta }
  }, [trends])

  // Quota forecast chart data
  const forecastChartData = forecastData?.data ?? []

  // Model consumption ranking (from heatmap)
  const modelConsumptionRanking = useMemo(() => {
    const modelTotals: Record<string, number> = {}
    for (const item of heatmapItems) {
      modelTotals[item.model_name] = (modelTotals[item.model_name] || 0) + item.count
    }
    return Object.entries(modelTotals)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [heatmapItems])

  // Channel type distribution (from stats - approximation using available data)
  const CHANNEL_TYPE_COLORS = [
    '#10a37f', '#1677ff', '#722ed1', '#fa8c16', '#eb2f96',
    '#52c41a', '#13c2c2', '#faad14', '#ff4d4f', '#2f54eb',
  ]

  // Error rate
  const errorRateChannels = errorRateData?.data?.channels ?? []
  const errorRateModels = errorRateData?.data?.models ?? []
  const errorRateChartData = (errorRateView === 'channels'
    ? errorRateChannels.slice(0, 10).map((c) => ({
        name: c.channel_name,
        error_rate: c.error_rate,
        total_requests: c.total_requests,
      }))
    : errorRateModels.slice(0, 10).map((m) => ({
        name: m.model_name,
        error_rate: m.error_rate,
        total_requests: m.total_requests,
      }))
  )

  return (
    <div>
      {/* Hero Greeting */}
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {greeting.emoji} {greeting.text}，管理员
        </Typography.Title>
        <Typography.Text type="secondary">{getDateLabel()}</Typography.Text>
      </div>

      {/* Auto-refresh countdown bar */}
      <div
        style={{
          height: 3,
          width: '100%',
          background: isDark ? '#303030' : '#f0f0f0',
          borderRadius: 1.5,
          marginBottom: 20,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: isVisible ? `${countdownPct}%` : '100%',
            background: isVisible
              ? countdown > 5
                ? '#1677ff'
                : '#ff4d4f'
              : '#8c8c8c',
            borderRadius: 1.5,
            transition: 'width 1s linear',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: -16,
          marginBottom: 16,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {isVisible ? `下次刷新 ${countdown}s` : '页面隐藏，刷新已暂停'}
        </Typography.Text>
      </div>

      {isError && (
        <Alert
          type="error"
          message="数据加载失败"
          description={error?.message || '系统概况数据加载失败，请稍后重试'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        {/* Primary card — Overview */}
        <Col xs={24} lg={12}>
          <Card style={primaryCardStyle} loading={isLoading}>
            <div style={{ opacity: 0.85, marginBottom: 4 }}>系统概况</div>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
              {stats ? `${stats.user_count} 用户 · ${stats.channel_count} 渠道 · ${stats.model_count} 模型` : '—'}
            </div>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ opacity: 0.85, fontSize: 12 }}>今日请求</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  {formatNumber(stats?.today_request_count)}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ opacity: 0.85, fontSize: 12 }}>今日 Token</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  {formatNumber(stats?.today_token_count)}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ opacity: 0.85, fontSize: 12 }}>消耗 / 充值</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  <span style={{ color: quotaRatio > 0.7 ? '#ffe58f' : undefined }}>
                    {formatNumber(stats?.today_quota_consumed)}
                  </span>
                  {' / '}
                  {formatNumber(stats?.today_quota_recharged)}
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Health Card */}
        <Col xs={12} lg={6}>
          <Card style={cardStyle} loading={isLoading}>
            <Statistic
              title="消费健康"
              value={healthLabel}
              valueStyle={{ color: healthColor, fontSize: 28 }}
              prefix={
                <span style={{ color: healthColor }}>
                  {quotaRatio > 1 ? '⚠️' : quotaRatio > 0.7 ? '⚡' : '✅'}
                </span>
              }
            />
            <div style={{ marginTop: 4 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                消耗/充值比: {(quotaRatio * 100).toFixed(0)}%
              </Typography.Text>
            </div>
          </Card>
        </Col>

        {/* User count */}
        <Col xs={12} lg={6}>
          <Card style={cardStyle} loading={isLoading}>
            <Statistic
              title="用户"
              value={formatNumber(stats?.user_count)}
              prefix={<UserOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>

        {/* Key count */}
        <Col xs={12} lg={6}>
          <Card style={cardStyle} loading={isLoading}>
            <Statistic
              title="API Keys"
              value={formatNumber(stats?.token_count)}
              prefix={<KeyOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>

        {/* Channel count with active/error breakdown */}
        <Col xs={12} lg={6}>
          <Card
            style={cardStyle}
            loading={isLoading}
            onClick={() => navigate('/channels')}
            hoverable
          >
            <Statistic
              title="渠道"
              value={formatNumber(stats?.channel_count)}
              prefix={<ClusterOutlined style={{ color: '#10a37f' }} />}
              suffix={
                <Space size={4} style={{ marginLeft: 4 }}>
                  {totalActive ? (
                    <Tooltip title={`活跃 ${stats?.active_channel_count ?? 0}`}>
                      <Tag color="green" style={{ marginInlineEnd: 0 }}>活跃</Tag>
                    </Tooltip>
                  ) : null}
                  {(stats?.error_channel_count ?? 0) > 0 ? (
                    <Tooltip title={`异常 ${stats?.error_channel_count ?? 0}`}>
                      <Tag color="red" style={{ marginInlineEnd: 0 }}>{stats?.error_channel_count}</Tag>
                    </Tooltip>
                  ) : null}
                </Space>
              }
            />
          </Card>
        </Col>

        {/* Model count */}
        <Col xs={12} lg={6}>
          <Card
            style={cardStyle}
            loading={isLoading}
            onClick={() => navigate('/models')}
            hoverable
          >
            <Statistic
              title="模型"
              value={formatNumber(stats?.model_count)}
              prefix={<ApartmentOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>

        {/* Today consumption */}
        <Col xs={12} lg={6}>
          <Card style={cardStyle} loading={isLoading}>
            <Statistic
              title="今日消耗"
              value={formatNumber(stats?.today_quota_consumed)}
              suffix="额度"
              prefix={<RiseOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>

        {/* RPM */}
        <Col xs={12} lg={6}>
          <Card style={cardStyle} loading={isLoading}>
            <Statistic
              title="RPM (请求/分钟)"
              value={rpm}
              prefix={<ThunderboltOutlined style={{ color: '#1677ff' }} />}
            />
            <Typography.Text
              style={{
                fontSize: 11,
                color: yesterdayDelta.requests > 0 ? '#ff4d4f' : '#52c41a',
              }}
            >
              {yesterdayDelta.requests > 0 ? '↑' : '↓'} {Math.abs(yesterdayDelta.requests).toFixed(0)}% vs 昨日
            </Typography.Text>
          </Card>
        </Col>

        {/* TPM */}
        <Col xs={12} lg={6}>
          <Card style={cardStyle} loading={isLoading}>
            <Statistic
              title="TPM (Token/分钟)"
              value={tpm}
              prefix={<FieldTimeOutlined style={{ color: '#13c2c2' }} />}
            />
          </Card>
        </Col>

        {/* Active channels */}
        <Col xs={12} lg={6}>
          <Card
            style={cardStyle}
            loading={isLoading}
            onClick={() => navigate('/channels')}
            hoverable
          >
            <Statistic
              title="活跃渠道"
              value={formatNumber(stats?.active_channel_count)}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>

        {/* Error channels */}
        <Col xs={12} lg={6}>
          <Card
            style={cardStyle}
            loading={isLoading}
            onClick={() => navigate('/channels')}
            hoverable
          >
            <Statistic
              title="异常渠道"
              value={formatNumber(stats?.error_channel_count)}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>

        {/* Monthly consumption */}
        <Col xs={12} lg={6}>
          <Card style={cardStyle} loading={isLoading}>
            <Statistic
              title="本月消费"
              value={formatNumber(stats?.month_quota_consumed)}
              suffix="额度"
              prefix={<DollarOutlined style={{ color: '#eb2f96' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Trends Charts (Tier 2) */}
      {!enableTier2 ? (
        <Card style={{ ...cardStyle, marginTop: 16 }}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : trendsIsError ? (
        <Card style={{ ...cardStyle, marginTop: 16 }}>
          <Alert
            type="error"
            message="趋势数据加载失败"
            description={trendsError?.message || '趋势数据加载失败，请稍后重试'}
            showIcon
          />
        </Card>
      ) : (
        <Card
          title="趋势分析（近 30 天）"
          style={{ ...cardStyle, marginTop: 16 }}
          loading={trendsLoading}
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
                每日请求数
              </Typography.Text>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ReTooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="#1677ff"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    name="请求数"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Col>
            <Col xs={24} lg={12}>
              <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
                每日额度消耗（元）
              </Typography.Text>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ReTooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="quotaYuan"
                    stroke="#52c41a"
                    fill="#52c41a"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    name="额度（元）"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Col>
          </Row>
        </Card>
      )}

      {/* Quick Actions */}
      <Card
        title="快捷操作"
        style={{ ...cardStyle, marginTop: 16 }}
        size="small"
      >
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => navigate('/channels')}>
            新增渠道
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => navigate('/tokens')}>
            新增 Key
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => navigate('/models')}>
            新增模型
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => navigate('/topups')}>
            用户充值
          </Button>
          <Button onClick={() => navigate('/logs')}>消费日志</Button>
          <Button onClick={() => navigate('/daily-bills')}>日账单</Button>
        </Space>
      </Card>

      {/* Model Capability Distribution (Tier 1 — immediate) */}
      <Card
        title="模型能力分布"
        style={{ ...cardStyle, marginTop: 16 }}
      >
        {capabilityChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={capabilityChartData}
              layout="vertical"
              margin={{ left: 20, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="capability"
                tick={{ fontSize: 12 }}
                width={80}
              />
              <ReTooltip formatter={(value: unknown) => [`${value} 个模型`, '数量']} />
              <Bar dataKey="count" fill="#1677ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Typography.Text type="secondary">暂无能力统计数据</Typography.Text>
        )}
      </Card>

      {/* Model Usage Heatmap (Tier 2) */}
      {!enableTier2 ? (
        <Card style={{ ...cardStyle, marginTop: 16 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : (
        <Card
          title="模型使用热力图（近 7 天）"
          style={{ ...cardStyle, marginTop: 16 }}
        >
          {heatmapModels.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `120px repeat(24, minmax(24px, 1fr))`,
                  gap: 2,
                  minWidth: 800,
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    fontWeight: 600,
                    padding: '4px 8px',
                    fontSize: 12,
                    color: isDark ? '#aaa' : '#666',
                  }}
                >
                  小时 →<br />模型 ↓
                </div>
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={`header-${h}`}
                    style={{
                      fontWeight: 600,
                      textAlign: 'center',
                      padding: '4px 2px',
                      fontSize: 11,
                      color: isDark ? '#aaa' : '#666',
                    }}
                    title={`${h}:00 - ${h}:59`}
                  >
                    {h}
                  </div>
                ))}
                {/* Data rows */}
                {heatmapModels.map((model) => (
                  <>
                    <div
                      key={`label-${model}`}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title={model}
                    >
                      {model}
                    </div>
                    {Array.from({ length: 24 }, (_, h) => {
                      const count = heatmapMatrix[model]?.[h] ?? 0
                      const intensity = count / heatmapMaxCount
                      const r = Math.round(235 - intensity * 210)
                      const g = Math.round(247 - intensity * 130)
                      const b = Math.round(255 - intensity * 30)
                      return (
                        <Tooltip
                          key={`${model}-${h}`}
                          title={`${model} @ ${h}:00 — ${count} 请求`}
                        >
                          <div
                            style={{
                              backgroundColor: count > 0 ? `rgb(${r},${g},${b})` : (isDark ? '#161616' : '#f5f5f5'),
                              minHeight: 28,
                              borderRadius: 2,
                              cursor: count > 0 ? 'pointer' : 'default',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {count > 0 && (
                              <span style={{ fontSize: 10, color: intensity > 0.5 ? '#fff' : isDark ? '#e0e0e0' : '#333' }}>
                                {count}
                              </span>
                            )}
                          </div>
                        </Tooltip>
                      )
                    })}
                  </>
                ))}
              </div>
            </div>
          ) : (
            <Typography.Text type="secondary">暂无热力图数据</Typography.Text>
          )}
        </Card>
      )}

      {/* Top Users + Top Tokens (Tier 3) */}
      {!enableTier3 ? (
        <Row gutter={[16, 16]} style={{ marginTop: 0 }}>
          <Col xs={24} lg={12}>
            <Card style={cardStyle}>
              <Skeleton active paragraph={{ rows: 8 }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card style={cardStyle}>
              <Skeleton active paragraph={{ rows: 8 }} />
            </Card>
          </Col>
        </Row>
      ) : (
        <Row gutter={[16, 16]} style={{ marginTop: 0 }}>
          <Col xs={24} lg={12}>
            <Card
              title="用户消费 Top 10（近 30 天）"
              style={cardStyle}
            >
              {topUsers.length > 0 ? (
                <Table
                  size="small"
                  dataSource={topUsers}
                  rowKey="user_id"
                  pagination={false}
                  columns={[
                    {
                      title: '#',
                      width: 40,
                      render: (_: unknown, __: unknown, idx: number) => idx + 1,
                    },
                    {
                      title: '用户名',
                      dataIndex: 'username',
                      render: (name: string, record: { user_id: number }) => (
                        <a onClick={() => openFinanceDrawer(record.user_id)} style={{ cursor: 'pointer' }}>
                          {name}
                        </a>
                      ),
                    },
                    {
                      title: '消费（元）',
                      dataIndex: 'quota_consumed',
                      render: (v: number) => (v / 100).toFixed(2),
                      align: 'right' as const,
                    },
                    {
                      title: '请求数',
                      dataIndex: 'request_count',
                      render: (v: number) => v.toLocaleString(),
                      align: 'right' as const,
                    },
                  ]}
                />
              ) : (
                <Typography.Text type="secondary">暂无用户消费数据</Typography.Text>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title="Token 消费 Top 10（近 30 天）"
              style={cardStyle}
            >
              {topTokens.length > 0 ? (
                <Table
                  size="small"
                  dataSource={topTokens}
                  rowKey="token_id"
                  pagination={false}
                  columns={[
                    {
                      title: '#',
                      width: 40,
                      render: (_: unknown, __: unknown, idx: number) => idx + 1,
                    },
                    {
                      title: '名称',
                      dataIndex: 'name',
                    },
                    {
                      title: 'Key',
                      dataIndex: 'key_mask',
                      render: (v: string) => (
                        <Typography.Text code style={{ fontSize: 11 }}>
                          {v}
                        </Typography.Text>
                      ),
                    },
                    {
                      title: '消费（元）',
                      dataIndex: 'quota_consumed',
                      render: (v: number) => (v / 100).toFixed(2),
                      align: 'right' as const,
                    },
                    {
                      title: '请求数',
                      dataIndex: 'request_count',
                      render: (v: number) => v.toLocaleString(),
                      align: 'right' as const,
                    },
                  ]}
                />
              ) : (
                <Typography.Text type="secondary">暂无 Token 消费数据</Typography.Text>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* Quota Forecast (Tier 3) */}
      {!enableTier3 ? (
        <Card style={{ ...cardStyle, marginTop: 16 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : forecastChartData.length > 0 ? (
        <Card
          title="配额消耗预测（30 天）"
          style={{ ...cardStyle, marginTop: 16 }}
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={forecastChartData}
              margin={{ top: 8, right: 20, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <ReTooltip
                formatter={(value: unknown) => {
                  const v = value as number
                  return [`${(v / 100).toFixed(2)} 元`, '预测消耗']
                }}
              />
              <Area
                type="monotone"
                dataKey="predicted_quota"
                stroke="#eb2f96"
                fill="#eb2f96"
                fillOpacity={0.15}
                strokeWidth={2}
                name="预测消耗"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      ) : null}

      {/* Model Consumption Ranking + Error Rate (side by side) */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Model Consumption Ranking */}
        <Col xs={24} lg={12}>
          <Card title="模型请求排行 Top 10（近 7 天）" style={cardStyle}>
            {modelConsumptionRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={modelConsumptionRanking}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <ReTooltip formatter={(value: unknown) => [`${value} 请求`, '请求数']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {modelConsumptionRanking.map((_, idx) => (
                      <Cell key={idx} fill={CHANNEL_TYPE_COLORS[idx % CHANNEL_TYPE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography.Text type="secondary">暂无模型排行数据</Typography.Text>
            )}
          </Card>
        </Col>

        {/* Error Rate Time Series */}
        <Col xs={24} lg={12}>
          <Card
            title="错误率趋势（近 7 天）"
            style={cardStyle}
            extra={
              <Space>
                <Button
                  size="small"
                  type={errorRateView === 'channels' ? 'primary' : 'default'}
                  onClick={() => setErrorRateView('channels')}
                >
                  按渠道
                </Button>
                <Button
                  size="small"
                  type={errorRateView === 'models' ? 'primary' : 'default'}
                  onClick={() => setErrorRateView('models')}
                >
                  按模型
                </Button>
              </Space>
            }
          >
            {errorRateChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={errorRateChartData}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <ReTooltip
                    formatter={(_value: unknown, _name: unknown, props: unknown) => {
                      const p = props as { payload: { error_rate: number; total_requests: number } }
                      return [`${p.payload.error_rate.toFixed(1)}%`, `错误率 (${p.payload.total_requests} 请求)`]
                    }}
                  />
                  <Bar dataKey="error_rate" radius={[0, 4, 4, 0]} maxBarSize={30}>
                    {errorRateChartData.map((entry, idx) => {
                      let fill = '#52c41a'
                      if (entry.error_rate > 5) fill = '#ff4d4f'
                      else if (entry.error_rate >= 1) fill = '#faad14'
                      return <Cell key={idx} fill={fill} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography.Text type="secondary">暂无错误率数据</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
