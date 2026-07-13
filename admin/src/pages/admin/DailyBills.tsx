import { useState, useMemo } from 'react'
import { Table, Button, Input, Space, Tabs, Card, Row, Col, App, Alert } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  listDailyBills,
  listMonthlyBills,
  aggregateDailyBills,
} from '../../api/dailyBill'
import { useFinanceContext } from '../../contexts/FinanceContext'
import EmptyState from '../../components/EmptyState'

function formatDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMonthInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatNumber(v: number): string {
  return v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toLocaleString()
}

function formatPrice(v: number): string {
  return (v / 100).toFixed(2) + '元'
}

function formatPriceYuan(v: number): string {
  return v.toFixed(2) + '元'
}

function exportCSV(rows: Record<string, any>[]) {
  if (rows.length === 0) return
  const fields = ['bill_date', 'user_id', 'model_name', 'request_count', 'token_count', 'quota_consumed_yuan', 'quota_recharged_yuan']
  const header = fields.join(',')
  const body = rows
    .map((r) =>
      fields
        .map((f) => {
          let v: any
          if (f === 'quota_consumed_yuan') v = ((r.quota_consumed ?? 0) / 100).toFixed(2)
          else if (f === 'quota_recharged_yuan') v = ((r.quota_recharged ?? 0) / 100).toFixed(2)
          else v = r[f]
          return typeof v === 'string' ? `"${v}"` : (v ?? '')
        })
        .join(','),
    )
    .join('\n')
  const csv = '\uFEFF' + header + '\n' + body
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `日账单_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const dailyColumns = [
  { title: 'ID', dataIndex: 'id', width: 60 },
  { title: '日期', dataIndex: 'bill_date', width: 120 },
  { title: '用户ID', dataIndex: 'user_id', width: 80 },
  { title: '模型', dataIndex: 'model_name', width: 150 },
  { title: '请求数', dataIndex: 'request_count', width: 100, render: (v: number) => formatNumber(v) },
  { title: 'Token数', dataIndex: 'token_count', width: 100, render: (v: number) => formatNumber(v) },
  { title: '消耗额度', dataIndex: 'quota_consumed', width: 120, render: (v: number) => formatPrice(v) },
  { title: '充值额度', dataIndex: 'quota_recharged', width: 120, render: (v: number) => formatPrice(v) },
]

const monthlyColumns = [
  { title: '月份', dataIndex: 'month', width: 120 },
  { title: '请求数', dataIndex: 'request_count', width: 100, render: (v: number) => formatNumber(v) },
  { title: 'Token数', dataIndex: 'token_count', width: 100, render: (v: number) => formatNumber(v) },
  { title: '消耗额度', dataIndex: 'quota_consumed', width: 120, render: (v: number) => formatPrice(v) },
  { title: '充值额度', dataIndex: 'quota_recharged', width: 120, render: (v: number) => formatPrice(v) },
]

interface ChartDataPoint {
  bill_date: string
  quota_consumed: number
  request_count: number
}

export default function DailyBills() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { openFinanceDrawer } = useFinanceContext()
  const [activeTab, setActiveTab] = useState('daily')

  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const [dailyPage, setDailyPage] = useState(1)
  const [startDate, setStartDate] = useState(formatDateInput(thirtyDaysAgo))
  const [endDate, setEndDate] = useState(formatDateInput(today))
  const [dailyUserId, setDailyUserId] = useState('')
  const [aggregateDate, setAggregateDate] = useState(formatDateInput(today))

  const [monthlyUserId, setMonthlyUserId] = useState('')
  const [startMonth, setStartMonth] = useState(formatMonthInput(thirtyDaysAgo))
  const [endMonth, setEndMonth] = useState(formatMonthInput(today))

  const parsedDailyUserId = dailyUserId ? Number(dailyUserId) : undefined
  const parsedMonthlyUserId = monthlyUserId ? Number(monthlyUserId) : undefined

  const dailyQuery = useQuery({
    queryKey: ['dailyBills', dailyPage, startDate, endDate, parsedDailyUserId],
    queryFn: () => listDailyBills(dailyPage, 20, startDate, endDate, parsedDailyUserId),
    enabled: activeTab === 'daily',
  })

  const monthlyQuery = useQuery({
    queryKey: ['monthlyBills', startMonth, endMonth, parsedMonthlyUserId],
    queryFn: () => listMonthlyBills(startMonth, endMonth, parsedMonthlyUserId),
    enabled: activeTab === 'monthly',
  })

  if (dailyQuery.isError || monthlyQuery.isError) {
    const err = dailyQuery.error || monthlyQuery.error
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="加载失败"
          description={(err as Error)?.message || '请稍后重试'}
          showIcon
        />
      </div>
    )
  }

  const aggregateMutation = useMutation({
    mutationFn: aggregateDailyBills,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '汇总失败')
        return
      }
      message.success('账单汇总成功')
      queryClient.invalidateQueries({ queryKey: ['dailyBills'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const dailyData = useMemo(() => dailyQuery.data?.data?.data || [], [dailyQuery.data])
  const monthlyData = useMemo(() => monthlyQuery.data?.data?.data || [], [monthlyQuery.data])

  const dailyTotals = useMemo(() => ({
    consumed: dailyData.reduce((sum: number, item: any) => sum + (item.quota_consumed || 0), 0),
    recharged: dailyData.reduce((sum: number, item: any) => sum + (item.quota_recharged || 0), 0),
  }), [dailyData])

  const monthlyTotals = useMemo(() => ({
    consumed: monthlyData.reduce((sum: number, item: any) => sum + (item.quota_consumed || 0), 0),
    recharged: monthlyData.reduce((sum: number, item: any) => sum + (item.quota_recharged || 0), 0),
  }), [monthlyData])

  const chartData: ChartDataPoint[] = useMemo(() => {
    const map = new Map<string, { quota_consumed: number; request_count: number }>()
    for (const item of dailyData) {
      const date = item.bill_date as string
      const entry = map.get(date) || { quota_consumed: 0, request_count: 0 }
      entry.quota_consumed += item.quota_consumed || 0
      entry.request_count += item.request_count || 0
      map.set(date, entry)
    }
    return Array.from(map.entries())
      .map(([bill_date, v]) => ({ bill_date, quota_consumed: v.quota_consumed / 100, request_count: v.request_count }))
      .sort((a, b) => a.bill_date.localeCompare(b.bill_date))
  }, [dailyData])

  const displayColumns = useMemo(() => dailyColumns.map(col =>
    col.dataIndex === 'user_id'
      ? { ...col, render: (id: number) => <a onClick={() => openFinanceDrawer(id)} style={{ cursor: 'pointer' }}>{id}</a> }
      : col
  ), [openFinanceDrawer])

  const tabItems = [
    {
      key: 'daily',
      label: '日账单',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: 160 }}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: 160 }}
            />
            <Input.Search
              placeholder="用户ID"
              onSearch={() => setDailyPage(1)}
              onChange={(e) => setDailyUserId(e.target.value)}
              value={dailyUserId}
              style={{ width: 160 }}
              allowClear
            />
            <Button type="primary" onClick={() => setDailyPage(1)}>
              查询
            </Button>
            <Button onClick={() => exportCSV(dailyData)}>导出 CSV</Button>
          </Space>

          <Space wrap>
            <Input
              type="date"
              value={aggregateDate}
              onChange={(e) => setAggregateDate(e.target.value)}
              style={{ width: 160 }}
            />
            <Button onClick={() => aggregateMutation.mutate(aggregateDate)} loading={aggregateMutation.isPending}>
              汇总指定日期账单
            </Button>
          </Space>

          <Card size="small">
            <Row gutter={24}>
              <Col>
                <span style={{ color: '#888' }}>总消耗额度：</span>
                <span style={{ fontWeight: 'bold' }}>{formatPrice(dailyTotals.consumed)}</span>
              </Col>
              <Col>
                <span style={{ color: '#888' }}>总充值额度：</span>
                <span style={{ fontWeight: 'bold' }}>{formatPrice(dailyTotals.recharged)}</span>
              </Col>
            </Row>
          </Card>

          {dailyData.length > 0 && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Card title="每日消耗额度趋势" size="small">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bill_date" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={formatPriceYuan} />
                      <Tooltip formatter={(value: any) => [formatPriceYuan(Number(value) || 0), '消耗额度']} />
                      <Area type="monotone" dataKey="quota_consumed" stroke="#1677ff" fill="#1677ff" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="每日请求数" size="small">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bill_date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="request_count" fill="#52c41a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          )}

          <Table
            size="middle"
            scroll={{ x: 'max-content' }}
            loading={dailyQuery.isLoading}
            dataSource={dailyData}
            rowKey="id"
            locale={{ emptyText: <EmptyState description="暂无日账单数据" /> }}
            pagination={{
              current: dailyPage,
              pageSize: 20,
              total: dailyQuery.data?.data?.pagination?.total || 0,
              onChange: setDailyPage,
              showTotal: (total: number) => `共 ${total} 条`,
            }}
            columns={displayColumns}
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
            <Input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              style={{ width: 160 }}
            />
            <Input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              style={{ width: 160 }}
            />
            <Input.Search
              placeholder="用户ID"
              onChange={(e) => setMonthlyUserId(e.target.value)}
              value={monthlyUserId}
              style={{ width: 160 }}
              allowClear
            />
            <Button type="primary" onClick={() => monthlyQuery.refetch()}>
              查询
            </Button>
            <Button onClick={() => exportCSV(monthlyData)}>导出 CSV</Button>
          </Space>

          <Card size="small">
            <Row gutter={24}>
              <Col>
                <span style={{ color: '#888' }}>总消耗额度：</span>
                <span style={{ fontWeight: 'bold' }}>{formatPrice(monthlyTotals.consumed)}</span>
              </Col>
              <Col>
                <span style={{ color: '#888' }}>总充值额度：</span>
                <span style={{ fontWeight: 'bold' }}>{formatPrice(monthlyTotals.recharged)}</span>
              </Col>
            </Row>
          </Card>

          <Table
            size="middle"
            scroll={{ x: 'max-content' }}
            loading={monthlyQuery.isLoading}
            dataSource={monthlyData}
            rowKey="month"
            locale={{ emptyText: <EmptyState description="暂无月账单数据" /> }}
            pagination={false}
            columns={monthlyColumns}
          />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  )
}
