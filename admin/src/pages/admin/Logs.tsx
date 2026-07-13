import { useState, useMemo } from 'react'
import { Table, Button, Input, Space, Modal, Tag, Select, DatePicker, App, Alert } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { listLogs, exportLogsCSV, type Log, type LogFilter } from '../../api/log'
import { useThemeStore } from '../../stores/themeStore'
import { useAuthStore } from '../../stores/authStore'
import { useFinanceContext } from '../../contexts/FinanceContext'
import EmptyState from '../../components/EmptyState'

const TYPE_MAP: Record<string, string> = {
  chat: '聊天',
  image: '图像',
  audio: '音频',
  embedding: '嵌入',
}

const TYPE_COLORS: Record<string, string> = {
  chat: 'blue',
  image: 'green',
  audio: 'purple',
  embedding: 'orange',
}

const TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'chat', label: '聊天' },
  { value: 'image', label: '图像' },
  { value: 'audio', label: '音频' },
  { value: 'embedding', label: '嵌入' },
]

function formatNumber(v: number) {
  return v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toLocaleString()
}

function formatQuota(v: number) {
  return (v / 100).toFixed(2) + '元'
}

function getStatusCodeColor(value: number) {
  if (value >= 200 && value < 300) return 'green'
  if (value >= 400 && value < 500) return 'orange'
  if (value >= 500) return 'red'
  return 'default'
}

const columns = [
  { title: 'ID', dataIndex: 'id', width: 60 },
  { title: '用户ID', dataIndex: 'user_id' },
  {
    title: 'TokenID',
    dataIndex: 'token_id',
    render: (value?: number) => value ?? '-',
  },
  {
    title: '渠道ID',
    dataIndex: 'channel_id',
    render: (value?: number) => value ?? '-',
  },
  {
    title: 'IP',
    dataIndex: 'ip_address',
    render: (value: string) => value || '-',
  },
  { title: '模型', dataIndex: 'model_name' },
  {
    title: '类型',
    dataIndex: 'type',
    render: (value: string) => (
      <Tag color={TYPE_COLORS[value] || 'default'}>{TYPE_MAP[value] ?? value}</Tag>
    ),
  },
  {
    title: '模式',
    dataIndex: 'mode',
    render: (value: string) => (value === 'stream' ? '流式' : '非流式'),
  },
  {
    title: 'Prompt',
    dataIndex: 'prompt_tokens',
    render: (value: number) => formatNumber(value),
  },
  {
    title: 'Completion',
    dataIndex: 'completion_tokens',
    render: (value: number) => formatNumber(value),
  },
  {
    title: 'Total',
    dataIndex: 'total_tokens',
    render: (value: number) => formatNumber(value),
  },
  {
    title: '消耗额度',
    dataIndex: 'quota_used',
    render: (value: number) => formatQuota(value),
  },
  {
    title: '状态码',
    dataIndex: 'status_code',
    render: (value: number) => (
      <Tag color={getStatusCodeColor(value)}>{value}</Tag>
    ),
  },
  { title: '耗时(ms)', dataIndex: 'use_time_ms' },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    render: (value: string) => value || '-',
  },
]

export default function Logs() {
  const { message } = App.useApp()
  const { openFinanceDrawer } = useFinanceContext()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 100 || user?.role === 10
  const [page, setPage] = useState(1)
  const [userId, setUserId] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [modelName, setModelName] = useState('')
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState('')
  const [statusCode, setStatusCode] = useState('')
  const [ipAddress, setIPAddress] = useState('')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [selectedLog, setSelectedLog] = useState<Log | null>(null)

  const filter: LogFilter = useMemo(() => {
    const f: LogFilter = {}
    if (userId) f.user_id = Number(userId)
    if (tokenId) f.token_id = Number(tokenId)
    if (modelName) f.model_name = modelName
    if (keyword) f.keyword = keyword
    if (type) f.type = type
    if (statusCode) f.status_code = Number(statusCode)
    if (ipAddress) f.ip_address = ipAddress
    if (dateRange) {
      f.start_date = dateRange[0]
      f.end_date = dateRange[1]
    }
    return f
  }, [userId, tokenId, modelName, keyword, type, statusCode, ipAddress, dateRange])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['logs', page, filter, keyword, tokenId, ipAddress],
    queryFn: () => listLogs(page, 20, filter),
  })

  const rows = data?.data?.data || []

  const displayColumns = useMemo(() => columns.map(col =>
    col.dataIndex === 'user_id'
      ? { ...col, render: (id: number) => <a onClick={() => openFinanceDrawer(id)} style={{ cursor: 'pointer' }}>{id}</a> }
      : col
  ), [openFinanceDrawer])

  if (isError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="加载失败"
          description={error?.message || '日志数据加载失败，请稍后重试'}
          showIcon
        />
      </div>
    )
  }

  const handleSearch = () => {
    if (userId && !Number(userId)) {
      message.warning('用户ID必须为数字')
      return
    }
    if (statusCode && !Number(statusCode)) {
      message.warning('状态码必须为数字')
      return
    }
    setPage(1)
  }

  const handleExport = async () => {
    try {
      const blob = await exportLogsCSV(filter)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `logs-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      message.success('导出成功')
    } catch {
      message.error('导出失败')
    }
  }

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space wrap>
          <Input.Search
            placeholder="关键词"
            onSearch={handleSearch}
            onChange={(e) => setKeyword(e.target.value)}
            value={keyword}
            style={{ width: 160 }}
            allowClear
          />
          <Input.Search
            placeholder="用户ID"
            onSearch={handleSearch}
            onChange={(e) => setUserId(e.target.value)}
            value={userId}
            style={{ width: 140 }}
            allowClear
          />
          <Input.Search
            placeholder="TokenID"
            onSearch={handleSearch}
            onChange={(e) => setTokenId(e.target.value)}
            value={tokenId}
            style={{ width: 140 }}
            allowClear
          />
          <Input.Search
            placeholder="模型名"
            onSearch={handleSearch}
            onChange={(e) => setModelName(e.target.value)}
            value={modelName}
            style={{ width: 160 }}
            allowClear
          />
          {isAdmin && (
            <Input.Search
              placeholder="IP地址"
              onSearch={handleSearch}
              onChange={(e) => setIPAddress(e.target.value)}
              value={ipAddress}
              style={{ width: 160 }}
              allowClear
            />
          )}
          <Select
            value={type}
            onChange={(value) => {
              setType(value)
              setPage(1)
            }}
            style={{ width: 120 }}
            options={TYPE_OPTIONS}
          />
          <Input.Search
            placeholder="状态码"
            onSearch={handleSearch}
            onChange={(e) => setStatusCode(e.target.value)}
            value={statusCode}
            style={{ width: 120 }}
            allowClear
          />
          <DatePicker.RangePicker
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
              } else {
                setDateRange(null)
              }
              setPage(1)
            }}
            style={{ width: 250 }}
            placeholder={['开始日期', '结束日期']}
          />
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 CSV</Button>
        </Space>

        <Table
          size="middle"
          loading={isLoading}
          dataSource={rows}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <EmptyState description="暂无消费日志" /> }}
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.data?.pagination?.total || 0,
            showTotal: (total) => `共 ${total} 条`,
            onChange: setPage,
          }}
          columns={displayColumns}
          onRow={(record) => ({
            onClick: () => setSelectedLog(record),
            style: { cursor: 'pointer' },
          })}
        />
      </Space>

      <Modal
        title={`日志详情 #${selectedLog?.id}`}
        open={selectedLog !== null}
        onCancel={() => setSelectedLog(null)}
        onOk={() => setSelectedLog(null)}
        width={800}
      >
        {selectedLog && (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div>
              <strong>Request ID:</strong> {selectedLog.request_id}
            </div>
            <div>
              <strong>IP:</strong> {selectedLog.ip_address}
            </div>
            <div>
              <strong>User Agent:</strong> {selectedLog.user_agent || '-'}
            </div>
            <div>
              <strong>上游状态:</strong> {selectedLog.upstream_status || '-'}
            </div>
            {selectedLog.error_message && (
              <div>
                <strong>错误信息:</strong> {selectedLog.error_message}
              </div>
            )}
            <div>
              <strong>请求内容:</strong>
              <pre style={{ maxHeight: 200, overflow: 'auto', background: isDark ? '#1f1f1f' : '#f5f5f5', padding: 8 }}>
                {selectedLog.request_content || '-'}
              </pre>
            </div>
            <div>
              <strong>响应内容:</strong>
              <pre style={{ maxHeight: 200, overflow: 'auto', background: isDark ? '#1f1f1f' : '#f5f5f5', padding: 8 }}>
                {selectedLog.response_content || '-'}
              </pre>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}
