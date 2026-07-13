import { Table, Spin, Empty, Tag, Row, Col, Card, Statistic, Typography, Button, theme } from 'antd'
const { Text } = Typography
import { useThemeStore } from '../stores/themeStore'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getUserFinance, type UserFinanceData } from '../api/user'

export function UserFinanceTab({ userId, onViewAllTransactions }: { userId: number; onViewAllTransactions: () => void }) {
  const isDark = useThemeStore((s) => s.theme) === 'dark'
  const { token } = theme.useToken()
  const chartColor = token.colorPrimary
  const chartFill = isDark ? 'rgba(22,119,255,0.15)' : '#1677ff20'
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['user-finance', userId],
    queryFn: async () => {
      const res = await getUserFinance(userId)
      // Interceptor unwraps AxiosResponse at runtime; cast for TS
      const apiRes = res as unknown as { code: number; message: string; data?: UserFinanceData }
      if (apiRes.code !== 0) throw new Error(apiRes.message || '查询失败')
      if (!apiRes.data) throw new Error('查询返回空数据')
      return apiRes.data
    },
  })

  if (isLoading) return <Spin />
  if (!apiData) return <Empty description="暂无财务数据" />
  const data = apiData

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small">
            <Statistic title="剩余额度" value={data.quota / 100} precision={2} suffix="元" />
            <Text type="secondary">已用 {(data.used_quota / 100).toFixed(2)} 元</Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <Statistic title="今日消费" value={data.today_consumed / 100} precision={2} suffix="元" />
            <Text type="secondary">{data.today_requests} 请求 · {data.today_tokens} Token</Text>
          </Card>
        </Col>
      </Row>

      {Array.isArray(data.trends) && data.trends.length > 0 && (
        <Card size="small" title="近 30 天消费趋势" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.trends}>
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: unknown) => `${((v as number) / 100).toFixed(2)} 元`} />
              <Area type="monotone" dataKey="consumed" stroke={chartColor} fill={chartFill} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card size="small" title="近期额度流水" style={{ marginBottom: 16 }}
        extra={<Button type="link" size="small" onClick={onViewAllTransactions}>查看全部 →</Button>}>
        <Table
          dataSource={data.recent_transactions || []}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '时间', dataIndex: 'created_at', render: (d: string) => new Date(d).toLocaleString('zh-CN') },
            { title: '类型', dataIndex: 'type', render: (t: string) => <Tag color={t === 'consume' ? 'red' : t === 'recharge' ? 'green' : t === 'adjust' ? 'orange' : 'blue'}>{t}</Tag> },
            { title: '金额', dataIndex: 'amount', render: (v: number) => <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>{(v / 100).toFixed(2)} 元</span> },
            { title: '余额', dataIndex: 'balance_after', render: (v: number) => `${(v / 100).toFixed(2)} 元` },
          ]}
        />
      </Card>

      <Card size="small" title="订阅状态">
        {!Array.isArray(data.subscriptions) || data.subscriptions.length === 0 ? (
          <Text type="secondary">暂无订阅</Text>
        ) : (
          data.subscriptions.map((sub) => (
            <Tag key={sub.id} color={sub.status === 1 ? 'green' : 'default'}>
              套餐 #{sub.plan_id} {sub.status === 1 ? '生效中' : sub.status === 2 ? '已过期' : '已取消'}
            </Tag>
          ))
        )}
      </Card>
    </div>
  )
}
