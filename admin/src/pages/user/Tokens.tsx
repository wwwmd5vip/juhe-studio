import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Tag,
  Space,
  App,
  Popconfirm,
  Spin,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  listTokens,
  createToken,
  updateToken,
  deleteToken,
  batchDeleteTokens,
  getTokenStats,
  type Token,
  type TokenForm,
  type TokenDailyStat,
} from '../../api/token'
import { listGroups } from '../../api/user'
import { listModels } from '../../api/model'
import EmptyState from '../../components/EmptyState'
import CsvImportModal from '../../components/CsvImportModal'

const STATUS_OPTIONS = [
  { value: 0, label: '禁用' },
  { value: 1, label: '启用' },
]

type FormValues = {
  name: string
  remain_quota: number
  unlimited_quota: boolean
  group: string
  model_limits: string[]
  status: number
}

const defaultFormValues: FormValues = {
  name: '',
  remain_quota: 0,
  unlimited_quota: false,
  group: '',
  model_limits: [],
  status: 1,
}

const formatNumber = (v: number) =>
  v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toLocaleString()

function formatLastUsedAt(value: string | null | undefined) {
  if (!value) return <Tag color="default">从未使用</Tag>
  const date = new Date(value)
  if (isNaN(date.getTime())) return <Tag color="default">从未使用</Tag>
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 24) {
    if (diffHours < 1) return '刚刚'
    return `${diffHours}小时前`
  }
  return value.slice(0, 10)
}

function exportCSV(rows: Record<string, any>[]) {
  if (rows.length === 0) return
  const fields = ['id', 'name', 'key_mask', 'user_id', 'quota_yuan', 'used_quota_yuan', 'status', 'last_used_at', 'expired_at']
  const header = fields.join(',')
  const body = rows
    .map((r) =>
      fields
        .map((f) => {
          let v: any
          if (f === 'quota_yuan') v = ((r.remain_quota ?? 0) / 100).toFixed(2)
          else if (f === 'used_quota_yuan') v = ((r.remain_quota ?? 0) / 100).toFixed(2)
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
  a.download = `Token列表_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function transformFormValues(values: FormValues, editing: boolean): TokenForm & { status?: number } {
  const payload: TokenForm & { status?: number } = {
    name: values.name,
    remain_quota: values.remain_quota,
    unlimited_quota: values.unlimited_quota,
    group: values.group,
    model_limits: values.model_limits,
  }
  if (editing) {
    payload.status = values.status
  }
  return payload
}

export default function Tokens() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [form] = Form.useForm<FormValues>()
  const [groupOptions, setGroupOptions] = useState<string[]>(['default'])
  const [modelOptions, setModelOptions] = useState<string[]>([])
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Lazy-fetched stats for expanded rows
  const [statsData, setStatsData] = useState<Record<number, TokenDailyStat[]>>({})
  const [statsLoading, setStatsLoading] = useState<Record<number, boolean>>({})

  const fetchStats = async (id: number) => {
    if (statsData[id]) return
    setStatsLoading((prev) => ({ ...prev, [id]: true }))
    try {
      const res = await getTokenStats(id, 30)
      if (res.code === 0 && Array.isArray(res.data)) {
        setStatsData((prev) => ({ ...prev, [id]: res.data as TokenDailyStat[] }))
      }
    } catch {
      // silently fail
    } finally {
      setStatsLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  // Load groups and model names for dropdowns
  useEffect(() => {
    let cancelled = false
    listGroups().then(res => {
      if (cancelled) return
      if (res.code === 0 && Array.isArray(res.data) && res.data.length > 0) {
        setGroupOptions([...new Set(['default', ...res.data])])
      }
    }).catch(() => {})
    listModels(1, 200).then(res => {
      if (cancelled) return
      if (res.code === 0 && res.data?.data) {
        setModelOptions(res.data.data.map((m: { model_name: string }) => m.model_name))
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['tokens', page, keyword],
    queryFn: () => listTokens(page, 20, keyword),
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => createToken(transformFormValues(values, false)),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '创建失败')
        return
      }
      message.success('创建成功')
      setIsModalOpen(false)
      setEditingId(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
      if (res.data?.key) {
        setCreatedKey(res.data.key)
      }
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: FormValues }) =>
      updateToken(id, transformFormValues(values, true)),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '更新失败')
        return
      }
      message.success('更新成功')
      setIsModalOpen(false)
      setEditingId(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) =>
      updateToken(id, { status }),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '状态切换失败')
        return
      }
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteToken,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteTokens,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '批量删除失败')
        return
      }
      message.success('批量删除成功')
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const handleSubmit = (values: FormValues) => {
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleOpenModal = () => {
    setEditingId(null)
    form.setFieldsValue(defaultFormValues)
    setIsModalOpen(true)
  }

  const handleEdit = (record: Token) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      remain_quota: record.remain_quota,
      unlimited_quota: record.unlimited_quota,
      group: record.group,
      model_limits: record.model_limits || [],
      status: record.status,
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingId(null)
    form.resetFields()
  }

  const handleCopyKey = async () => {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    } catch {
      message.info('请手动复制')
    }
  }

  const handleExpandChange = (_expanded: boolean, record: Token) => {
    if (!statsData[record.id]) {
      fetchStats(record.id)
    }
  }

  const expandedRowRender = (record: Token) => {
    const stats = statsData[record.id]
    const loading = statsLoading[record.id]

    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
          <p style={{ marginTop: 8, color: '#999' }}>加载用量数据...</p>
        </div>
      )
    }

    if (!stats || stats.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
          暂无用量数据
        </div>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={stats} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis tick={{ fontSize: 11 }} width={50} />
          <Tooltip
            formatter={(value: unknown) => {
              const num = typeof value === 'number' ? value : 0
              return [(num / 100).toFixed(2) + ' 元', '消耗额度']
            }}
            labelFormatter={(label: unknown) => `日期: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="quota_used"
            stroke="#667eea"
            fill="#667eea"
            fillOpacity={0.15}
            strokeWidth={2}
            name="消耗额度"
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    {
      title: 'Key',
      dataIndex: 'key_mask',
      render: (value: string) => value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: number, record: Token) => (
        <Space size="small">
          <Switch
            checked={status === 1}
            loading={toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === record.id}
            onChange={(checked) =>
              toggleStatusMutation.mutate({ id: record.id, status: checked ? 1 : 0 })
            }
          />
          <Tag color={status === 1 ? 'green' : 'red'}>
            {status === 1 ? '启用' : '禁用'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '剩余额度',
      dataIndex: 'remain_quota',
      render: (value: number, record: Token) => (
        <Space size="small">
          <span>{formatNumber(value)}</span>
          {value < 1000 && !record.unlimited_quota && (
            <Tag color="orange">即将耗尽</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '无限额度',
      dataIndex: 'unlimited_quota',
      render: (value: boolean) =>
        value ? <Tag color="green">无限</Tag> : '否',
    },
    { title: '分组', dataIndex: 'group' },
    {
      title: '最近使用',
      dataIndex: 'last_used_at',
      render: (value: string | null) => formatLastUsedAt(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Token) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除 Token "${record.name}" 吗？`}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              size="small"
              loading={deleteMutation.isPending && deleteMutation.variables === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const modalTitle = editingId !== null ? '编辑 Token' : '新增 Token'
  const submitLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Input.Search
          placeholder="搜索 Token 名称"
          allowClear
          style={{ width: 280 }}
          onSearch={(value) => { setKeyword(value); setPage(1) }}
        />
        <Space>
          <Button onClick={() => exportCSV(data?.data?.data || [])}>导出 CSV</Button>
          <Button onClick={() => setImportModalOpen(true)}>批量导入</Button>
          <Button type="primary" onClick={handleOpenModal}>
            新增 Token
          </Button>
        </Space>
      </div>

      {selectedIds.length > 0 && (
        <Space style={{ marginBottom: 16 }}>
          <span>已选择 {selectedIds.length} 项</span>
          <Popconfirm
            title="确认批量删除"
            description={`确定删除选中的 ${selectedIds.length} 个 Token 吗？`}
            onConfirm={() => batchDeleteMutation.mutate(selectedIds)}
            okText="确定"
            cancelText="取消"
          >
            <Button danger loading={batchDeleteMutation.isPending}>
              批量删除
            </Button>
          </Popconfirm>
        </Space>
      )}

      <Table
        size="middle"
        loading={isLoading}
        dataSource={data?.data?.data || []}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <EmptyState title="暂无 API Key" description="创建第一个 API Key 开始使用" actionText="新建 Key" onAction={handleOpenModal} /> }}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.data?.pagination?.total || 0,
          showTotal: (total) => `共 ${total} 条`,
          onChange: setPage,
        }}
        columns={columns}
        expandable={{
          expandedRowRender,
          onExpand: handleExpandChange,
          rowExpandable: () => true,
        }}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
        }}
      />

      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={handleCloseModal}
        onOk={async () => { try { await form.submit() } catch { /* validation failed, Ant Design shows inline errors */ } }}
        confirmLoading={submitLoading}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={defaultFormValues}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="Token 名称" />
          </Form.Item>

          <Space size="large" style={{ display: 'flex' }}>
            <Form.Item label="剩余额度" name="remain_quota">
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item name="unlimited_quota" valuePropName="checked" style={{ marginTop: 32 }}>
              <Switch checkedChildren="无限额度" unCheckedChildren="有限额度" />
            </Form.Item>
          </Space>

          <Form.Item
            label="分组"
            name="group"
            rules={[{ required: true, message: '请选择分组' }]}
            normalize={(value) => (Array.isArray(value) ? value[0] || '' : value)}
            getValueProps={(value) => ({ value: value ? [value] : [] })}
          >
            <Select
              mode="tags"
              maxCount={1}
              placeholder="选择或输入分组"
              options={groupOptions.map(g => ({ value: g, label: g }))}
            />
          </Form.Item>

          <Form.Item label="模型限制" name="model_limits">
            <Select
              mode="tags"
              placeholder="选择限制的模型，留空不限制"
              options={modelOptions.map(m => ({ value: m, label: m }))}
            />
          </Form.Item>

          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={STATUS_OPTIONS} placeholder="选择状态" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Token 已创建"
        open={createdKey !== null}
        onCancel={() => { setCreatedKey(null); setCopyFeedback(false) }}
        onOk={() => setCreatedKey(null)}
        footer={[
          <Button key="copy" type="primary" onClick={handleCopyKey}>
            复制 Key
          </Button>,
          <Button key="close" onClick={() => { setCreatedKey(null); setCopyFeedback(false) }}>
            关闭
          </Button>,
        ]}
      >
        <p>请立即复制并保存 Key，关闭后将无法再次查看完整 Key。</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input.TextArea value={createdKey || ''} rows={3} readOnly style={{ flex: 1 }} />
          {copyFeedback && <Tag color="green">已复制!</Tag>}
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <CsvImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="批量导入 Token"
        templateColumns={['name', 'user_id', 'remain_quota', 'group', 'model_limits']}
        templateUrl="/api/import/tokens"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tokens'] })}
      />
    </div>
  )
}
