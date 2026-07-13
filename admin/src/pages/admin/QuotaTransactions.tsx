import { useState, useMemo } from 'react'
import { Table, Button, Input, Space, Select, DatePicker, Tag, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { listQuotaTransactions } from '../../api/quotaTransaction'
import { useFinanceContext } from '../../contexts/FinanceContext'
import EmptyState from '../../components/EmptyState'

interface TransactionRecord {
  id: number
  user_id: number
  token_id?: number
  type: string
  amount: number
  balance_after: number
  related_id?: string
  related_type?: string
  description?: string
  created_at: string
}

const formatNumber = (v: number) =>
  v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toLocaleString()

const formatPrice = (v: number) => (v / 100).toFixed(2) + '元'

const formatSignedPrice = (v: number) =>
  (v >= 0 ? '+' : '') + (v / 100).toFixed(2) + '元'

function exportCSV(rows: Record<string, any>[]) {
  if (rows.length === 0) return
  const fields = ['id', 'user_id', 'type', 'amount_yuan', 'balance_after_yuan', 'related_id', 'created_at']
  const header = fields.join(',')
  const body = rows
    .map((r) =>
      fields
        .map((f) => {
          let v: any
          if (f === 'amount_yuan') v = ((r.amount ?? 0) / 100).toFixed(2)
          else if (f === 'balance_after_yuan') v = ((r.balance_after ?? 0) / 100).toFixed(2)
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
  a.download = `额度流水_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  recharge: { label: '充值', color: 'green' },
  consume: { label: '消费', color: 'red' },
  refund: { label: '退款', color: 'blue' },
  adjust: { label: '调整', color: 'orange' },
}

export default function QuotaTransactions() {
  const { openFinanceDrawer } = useFinanceContext()
  const [page, setPage] = useState(1)
  const [userId, setUserId] = useState('')
  const [searchUserId, setSearchUserId] = useState<number | undefined>(undefined)
  const [filterType, setFilterType] = useState<string | undefined>(undefined)
  const [filterDateRange, setFilterDateRange] = useState<[string, string] | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['quotaTransactions', page, searchUserId, filterType, filterDateRange],
    queryFn: () => listQuotaTransactions({
      page,
      page_size: 20,
      user_id: searchUserId,
      type: filterType,
      start_date: filterDateRange?.[0],
      end_date: filterDateRange?.[1],
    }),
  })

  if (isError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="加载失败"
          description={(error as Error)?.message || '请稍后重试'}
          showIcon
        />
      </div>
    )
  }

  const columns: ColumnsType<TransactionRecord> = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 80 },
      { title: '用户ID', dataIndex: 'user_id', width: 100, render: (id: number) => (
        <a onClick={() => openFinanceDrawer(id)} style={{ cursor: 'pointer' }}>{id}</a>
      ) },
      {
        title: 'TokenID',
        dataIndex: 'token_id',
        width: 100,
        render: (value?: number) => value ?? '-',
      },
      {
        title: '类型',
        dataIndex: 'type',
        width: 100,
        render: (value: string) => {
          const info = TYPE_MAP[value]
          return info ? (
            <Tag color={info.color}>{info.label}</Tag>
          ) : (
            value || '-'
          )
        },
      },
      {
        title: '变动额度',
        dataIndex: 'amount',
        width: 130,
        render: (value: number) => formatSignedPrice(value),
      },
      {
        title: '变动后余额',
        dataIndex: 'balance_after',
        width: 130,
        render: (value: number) => formatPrice(value),
      },
      {
        title: '关联ID',
        dataIndex: 'related_id',
        width: 120,
        render: (value?: string) => value || '-',
      },
      {
        title: '关联类型',
        dataIndex: 'related_type',
        width: 120,
        render: (value?: string) => value || '-',
      },
      {
        title: '描述',
        dataIndex: 'description',
        width: 200,
        render: (value?: string) => value || '-',
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) => value || '-',
      },
    ],
    [openFinanceDrawer],
  )

  const total = data?.data?.pagination?.total || 0

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="用户ID（可选）"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            onSearch={() => { const n = Number(userId); setSearchUserId(userId && !Number.isNaN(n) ? n : undefined); setPage(1) }}
            style={{ width: 160 }}
            allowClear
          />
          <Select
            placeholder="类型"
            value={filterType}
            onChange={v => { setFilterType(v); setPage(1) }}
            allowClear
            style={{ width: 120 }}
            options={[
              { label: '充值', value: 'recharge' },
              { label: '消费', value: 'consume' },
              { label: '退款', value: 'refund' },
              { label: '调整', value: 'adjust' },
            ]}
          />
          <DatePicker.RangePicker
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setFilterDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
              } else {
                setFilterDateRange(null)
              }
              setPage(1)
            }}
          />
          <Button onClick={() => exportCSV(data?.data?.data || [])}>导出 CSV</Button>
        </Space>
      </div>

      <Table<TransactionRecord>
        size="middle"
        scroll={{ x: 'max-content' }}
        loading={isLoading}
        dataSource={data?.data?.data || []}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showTotal: (t) => `共 ${formatNumber(t)} 条记录`,
          onChange: setPage,
        }}
        columns={columns}
        locale={{
          emptyText: <EmptyState description="暂无额度流水记录" />,
        }}
      />
    </div>
  )
}
