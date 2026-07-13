import { useState } from 'react'
import { Table, Tabs, DatePicker, Button, Space } from 'antd'
import { useQuery } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuthStore } from '../../stores/authStore'
import EmptyState from '../../components/EmptyState'

const { RangePicker } = DatePicker

// ── Types ──────────────────────────────────────────────

interface DailyBillItem {
  id: number
  bill_date: string
  user_id: number
  model_name: string
  request_count: number
  token_count: number
  quota_consumed: number
  quota_recharged: number
}

interface MonthlyBillItem {
  month: string
  request_count: number
  token_count: number
  quota_consumed: number
  quota_recharged: number
}

interface ApiResponse<T> {
  code: number
  message: string
  data?: T
}

interface Pagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

interface PagedResponse<T> {
  data: T[]
  pagination: Pagination
}

// ── Formatters ─────────────────────────────────────────

function formatNumber(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return v.toLocaleString()
}

function formatQuota(cents: number): string {
  return (cents / 100).toFixed(2) + '元'
}

// ── API helpers ────────────────────────────────────────

async function fetchRelay<T>(
  apiKey: string,
  path: string,
  params: Record<string, string | number>,
): Promise<ApiResponse<T>> {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== undefined && v !== null) {
      query.set(k, String(v))
    }
  }
  const url = `/v1${path}?${query.toString()}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (res.status === 401) {
    try { localStorage.removeItem('juhe_token') } catch { /* ignore */ }
    useAuthStore.getState().logout()
    throw new Error('未登录')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Columns ────────────────────────────────────────────

const dailyColumns = [
  { title: '日期', dataIndex: 'bill_date', width: 130 },
  { title: '请求数', dataIndex: 'request_count', width: 110, render: (v: number) => formatNumber(v) },
  { title: 'Token数', dataIndex: 'token_count', width: 110, render: (v: number) => formatNumber(v) },
  { title: '消耗额度', dataIndex: 'quota_consumed', width: 130, render: (v: number) => formatQuota(v) },
]

const monthlyColumns = [
  { title: '月份', dataIndex: 'month', width: 130 },
  { title: '请求数', dataIndex: 'request_count', width: 110, render: (v: number) => formatNumber(v) },
  { title: 'Token数', dataIndex: 'token_count', width: 110, render: (v: number) => formatNumber(v) },
  { title: '消耗额度', dataIndex: 'quota_consumed', width: 130, render: (v: number) => formatQuota(v) },
]

// ── Page ───────────────────────────────────────────────

export default function Billing() {
  const apiKey = useAuthStore((s) => s.token)
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily')

  // daily state
  const [dailyPage, setDailyPage] = useState(1)
  const [dailyRange, setDailyRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [dailyFilter, setDailyFilter] = useState<[string, string]>(() => [
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ])

  // monthly state
  const [monthlyPage, setMonthlyPage] = useState(1)
  const [monthlyRange, setMonthlyRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().subtract(6, 'month'),
    dayjs(),
  ])
  const [monthlyFilter, setMonthlyFilter] = useState<[string, string]>(() => [
    dayjs().subtract(6, 'month').format('YYYY-MM'),
    dayjs().format('YYYY-MM'),
  ])

  // ── Daily query ────────────────────────────────────

  const dailyQuery = useQuery({
    queryKey: ['billing-daily', dailyPage, dailyFilter],
    queryFn: async () => {
      if (!apiKey) throw new Error('未登录')
      const res = await fetchRelay<PagedResponse<DailyBillItem>>(
        apiKey,
        '/daily-bills',
        {
          page: dailyPage,
          page_size: 20,
          start_date: dailyFilter[0],
          end_date: dailyFilter[1],
        },
      )
      if (res.code !== 0) throw new Error(res.message || '查询失败')
      return res.data!
    },
    enabled: activeTab === 'daily' && !!apiKey,
  })

  // ── Monthly query ──────────────────────────────────

  const monthlyQuery = useQuery({
    queryKey: ['billing-monthly', monthlyPage, monthlyFilter],
    queryFn: async () => {
      if (!apiKey) throw new Error('未登录')
      const res = await fetchRelay<PagedResponse<MonthlyBillItem>>(
        apiKey,
        '/daily-bills/monthly',
        {
          page: monthlyPage,
          page_size: 20,
          start_month: monthlyFilter[0],
          end_month: monthlyFilter[1],
        },
      )
      if (res.code !== 0) throw new Error(res.message || '查询失败')
      return res.data!
    },
    enabled: activeTab === 'monthly' && !!apiKey,
  })

  // ── Render ─────────────────────────────────────────

  const tabItems = [
    {
      key: 'daily',
      label: '日账单',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
            <RangePicker
              value={dailyRange}
              onChange={(dates) => setDailyRange(dates as [Dayjs, Dayjs] | null)}
              allowClear={false}
            />
            <Button
              type="primary"
              onClick={() => {
                if (dailyRange && dailyRange[0] && dailyRange[1]) {
                  setDailyFilter([
                    dailyRange[0].format('YYYY-MM-DD'),
                    dailyRange[1].format('YYYY-MM-DD'),
                  ])
                  setDailyPage(1)
                }
              }}
            >
              查询
            </Button>
          </Space>

          <Table
            size="middle"
            loading={dailyQuery.isLoading}
            dataSource={dailyQuery.data?.data || []}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <EmptyState description="暂无消费记录" /> }}
            pagination={{
              current: dailyPage,
              pageSize: 20,
              total: dailyQuery.data?.pagination?.total || 0,
              onChange: setDailyPage,
              showTotal: (total: number) => `共 ${total} 条`,
            }}
            columns={dailyColumns}
          />
        </Space>
      ),
    },
    {
      key: 'monthly',
      label: '月账单',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
            <RangePicker
              picker="month"
              value={monthlyRange}
              onChange={(dates) => setMonthlyRange(dates as [Dayjs, Dayjs] | null)}
              allowClear={false}
            />
            <Button
              type="primary"
              onClick={() => {
                if (monthlyRange && monthlyRange[0] && monthlyRange[1]) {
                  setMonthlyFilter([
                    monthlyRange[0].format('YYYY-MM'),
                    monthlyRange[1].format('YYYY-MM'),
                  ])
                  setMonthlyPage(1)
                }
              }}
            >
              查询
            </Button>
          </Space>

          <Table
            size="middle"
            loading={monthlyQuery.isLoading}
            dataSource={monthlyQuery.data?.data || []}
            rowKey="month"
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <EmptyState description="暂无消费记录" /> }}
            pagination={{
              current: monthlyPage,
              pageSize: 20,
              total: monthlyQuery.data?.pagination?.total || 0,
              onChange: setMonthlyPage,
              showTotal: (total: number) => `共 ${total} 条`,
            }}
            columns={monthlyColumns}
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as 'daily' | 'monthly')} items={tabItems} />
    </div>
  )
}
