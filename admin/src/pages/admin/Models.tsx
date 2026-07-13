import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  AutoComplete,
  Space,
  App,
  Popconfirm,
  Tag,
  Typography,
  Switch,
  Drawer,
  Descriptions,
  Segmented,
} from 'antd'
import CapabilitySelector, { CapabilityTags } from '../../components/CapabilitySelector'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  listModels,
  createModel,
  updateModel,
  deleteModel,
  getModel,
  listModelChannels,
  type Model,
  type ModelForm,
  type ModelChannel,
} from '../../api/model'
import { listChannels, fetchChannelModels, type Channel } from '../../api/channel'
import { getChannelColor, getChannelLabel } from '../../styles/channel-colors'
import EmptyState from '../../components/EmptyState'

const MODEL_TYPES = [
  { value: 'llm', label: 'LLM' },
  { value: 'image', label: '图像' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'embedding', label: 'Embedding' },
]

const MODEL_TYPE_COLORS: Record<string, string> = {
  llm: '#1890ff',
  image: '#52c41a',
  video: '#fa8c16',
  audio: '#722ed1',
  embedding: '#eb2f96',
}

const MATCH_RULE_OPTIONS = [
  { value: 0, label: '精确匹配' },
  { value: 1, label: '前缀匹配' },
  { value: 2, label: '后缀匹配' },
  { value: 3, label: '包含匹配' },
]

const MATCH_RULE_LABELS: Record<number, string> = {
  0: '精确',
  1: '前缀',
  2: '后缀',
  3: '包含',
}

const CAPABILITY_LABELS: Record<string, string> = {
  'function-call': '函数调用',
  vision: '视觉',
  reasoning: '推理',
  'image-generation': '图像生成',
  'image-input': '图像输入',
  'audio-input': '音频输入',
  'audio-output': '音频输出',
  'video-input': '视频输入',
  'video-generation': '视频生成',
  embedding: '嵌入',
  rerank: '重排序',
  'web-search': '联网搜索',
  'structured-output': '结构化输出',
}

const ENDPOINT_OPTIONS = [
  '/v1/chat/completions',
  '/v1/images/generations',
  '/v1/embeddings',
  '/v1/audio/transcriptions',
  '/v1/audio/speech',
  '/v1/moderations',
  '/v1/rerank',
  '/v1/responses',
]

type FormValues = {
  model_name: string
  display_name: string
  upstream_name: string
  type: string
  channel_ids?: number[]
  capabilities: string[]
  endpoints: string[]
  context_window?: number
  max_output_tokens?: number
  match_rule: number
  status: number
}

const defaultFormValues: FormValues = {
  model_name: '',
  display_name: '',
  upstream_name: '',
  type: 'llm',
  channel_ids: undefined,
  capabilities: [],
  endpoints: [],
  context_window: undefined,
  max_output_tokens: undefined,
  match_rule: 0,
  status: 1,
}

/** Model type colored badge (参考 sub2api PlatformTypeBadge) */
function ModelTypeBadge({ type }: { type: string }) {
  const color = MODEL_TYPE_COLORS[type] ?? '#8c8c8c'
  const labels: Record<string, string> = {
    llm: 'LLM', image: 'Image', video: 'Video',
    audio: 'Audio', embedding: 'Embedding',
  }
  return (
    <Tag color={color} style={{ margin: 0 }}>
      {labels[type] ?? type}
    </Tag>
  )
}

function ModelDetailDrawer({
  open,
  model,
  loading,
  onClose,
}: {
  open: boolean
  model: Model | null
  loading: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()

  const { data: channelsData } = useQuery({
    queryKey: ['model-channels', model?.id],
    queryFn: () => listModelChannels(model!.id),
    enabled: !!model?.id,
  })

  const channels: ModelChannel[] = channelsData?.data || []

  return (
    <Drawer
      title="模型详情"
      open={open}
      onClose={onClose}
      width={480}
      loading={loading}
      destroyOnHidden
    >
      {model && (
        <Descriptions column={1} bordered size="small" styles={{ label: { width: 120 } }}>
          <Descriptions.Item label="模型名称">
            <Typography.Text strong>{model.model_name}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="显示名称">
            {model.display_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="类型">
            <ModelTypeBadge type={model.type} />
          </Descriptions.Item>
          <Descriptions.Item label="能力">
            <CapabilityTags capabilities={model.capabilities} max={12} />
          </Descriptions.Item>
          <Descriptions.Item label="端点">
            {model.endpoints && model.endpoints.length > 0 ? (
              <Space direction="vertical" size={2}>
                {model.endpoints.map((e) => (
                  <Typography.Text key={e} code>
                    {e}
                  </Typography.Text>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">-</Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="匹配规则">
            <Tag>{MATCH_RULE_LABELS[model.match_rule] ?? model.match_rule}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="上下文窗口">
            {model.context_window ? model.context_window.toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="最大输出 Token">
            {model.max_output_tokens ? model.max_output_tokens.toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {model.status === 1 ? (
              <Tag color="green">启用</Tag>
            ) : (
              <Tag color="red">禁用</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="关联渠道">
            {channels.length > 0 ? (
              <Space size={4} wrap>
                {channels
                  .filter((ch, i, arr) => arr.findIndex((x) => x.id === ch.id) === i)
                  .map((ch) => {
                  const color = getChannelColor(ch.type)
                  return (
                    <Tag
                      key={ch.id}
                      color={color.color}
                      style={{ cursor: 'pointer', margin: 0 }}
                      onClick={() => navigate('/channels')}
                    >
                      {ch.name}（{getChannelLabel(ch.type)}）
                    </Tag>
                  )
                })}
              </Space>
            ) : (
              <Typography.Text type="secondary">暂无关联渠道</Typography.Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Drawer>
  )
}

function ModelCapabilityMatrix({
  models,
  loading,
}: {
  models: Model[]
  loading: boolean
}) {
  const allCapabilities = [
    'function-call', 'vision', 'reasoning', 'image-generation',
    'image-input', 'audio-input', 'audio-output', 'embedding',
    'rerank', 'web-search', 'structured-output', 'video-input', 'video-generation',
  ]

  const matrixColumns = [
    {
      title: '模型名',
      dataIndex: 'model_name',
      key: 'model_name',
      fixed: 'left' as const,
      width: 160,
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    ...allCapabilities.map((cap) => ({
      title: CAPABILITY_LABELS[cap] ?? cap,
      dataIndex: cap,
      key: cap,
      width: 80,
      align: 'center' as const,
      render: (v?: boolean) => (v ? <span style={{ color: '#52c41a', fontSize: 16 }}>✓</span> : null),
    })),
  ]

  const matrixData = models.map((m) => {
    const row: Record<string, unknown> = {
      key: m.id,
      model_name: m.model_name,
    }
    allCapabilities.forEach((cap) => {
      row[cap] = (m.capabilities || []).includes(cap)
    })
    return row
  })

  return (
    <Table
      loading={loading}
      dataSource={matrixData}
      columns={matrixColumns}
      pagination={false}
      size="small"
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: <EmptyState description="暂无模型数据" /> }}
    />
  )
}

export default function Models() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [channelId, setChannelId] = useState<number | undefined>(undefined)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm<FormValues>()
  const initialValuesRef = useRef('')
  const closeForceRef = useRef(false)
  const dirty = useCallback(() => {
    return JSON.stringify(form.getFieldsValue()) !== initialValuesRef.current
  }, [form])

  // Warn on tab close / refresh when form has unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasChanges = JSON.stringify(form.getFieldsValue()) !== initialValuesRef.current
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [form])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detailModel, setDetailModel] = useState<Model | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [batchCapModalOpen, setBatchCapModalOpen] = useState(false)
  const [batchCapabilities, setBatchCapabilities] = useState<string[]>([])
  const [batchCapSaving, setBatchCapSaving] = useState(false)
  const [upstreamModels, setUpstreamModels] = useState<string[]>([])
  const [upstreamDetails, setUpstreamDetails] = useState<Record<string, { type?: string; capabilities?: string[] }>>({})
  const [fetchingModels, setFetchingModels] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cleanup timeout on unmount
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])
  // Ref for immediate duplicate-check exclusion in edit mode
  // (setState is async but form.setFieldsValue triggers sync validation).
  const editingModelIdRef = useRef<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['models', page, keyword, channelId],
    queryFn: () => listModels(page, 20, keyword, channelId),
  })

  // All existing model names for duplicate detection — fetched with large page size
  // to catch duplicates across all pages, not just the current pagination.
  const { data: allModelsData } = useQuery({
    queryKey: ['models', 'all-for-validation'],
    queryFn: () => listModels(1, 1000),
    staleTime: 120_000,
  })
  const existingModels = useMemo(
    () => new Map((allModelsData?.data?.data ?? []).map((m: Model) => [m.model_name, m.id])),
    [allModelsData],
  )

  const { data: channelsData } = useQuery({
    queryKey: ['channels', 'simple'],
    queryFn: () => listChannels(1, 200),
    staleTime: 60_000,
  })

  const createMutation = useMutation({
    mutationFn: createModel,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '创建失败'); return }
      message.success('创建成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['models'] })
      queryClient.invalidateQueries({ queryKey: ['models', 'all-for-validation'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<ModelForm> }) =>
      updateModel(id, values),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '更新失败'); return }
      message.success('更新成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['models'] })
      queryClient.invalidateQueries({ queryKey: ['models', 'all-for-validation'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteModel,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '删除失败'); return }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['models'] })
      queryClient.invalidateQueries({ queryKey: ['models', 'all-for-validation'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const handleBatchDelete = async () => {
    setBatchDeleting(true)
    try {
      const keys = [...selectedRowKeys]
      const results = await Promise.allSettled(
        keys.map(async (key) => {
          const res = await deleteModel(Number(key))
          if (res.code !== 0) throw new Error(res.message)
        })
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed === 0) {
        message.success(`成功删除 ${keys.length} 个模型`)
      } else {
        message.warning(`删除完成：${keys.length - failed} 成功，${failed} 失败`)
      }
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['models'] })
      queryClient.invalidateQueries({ queryKey: ['models', 'all-for-validation'] })
    } finally {
      setBatchDeleting(false)
    }
  }

  const handleBatchSetCapabilities = async () => {
    setBatchCapSaving(true)
    const keys = [...selectedRowKeys]
    const results = await Promise.allSettled(
      keys.map(async (key) => {
        const res = await updateModel(Number(key), { capabilities: batchCapabilities } as unknown as Partial<ModelForm>)
        if (res.code !== 0) throw new Error(res.message)
      })
    )
    setBatchCapSaving(false)
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed === 0) {
      message.success(`成功为 ${keys.length} 个模型设置能力`)
    } else {
      message.warning(`设置完成：${keys.length - failed} 成功，${failed} 失败`)
    }
    setSelectedRowKeys([])
    setBatchCapModalOpen(false)
    setBatchCapabilities([])
    queryClient.invalidateQueries({ queryKey: ['models'] })
    queryClient.invalidateQueries({ queryKey: ['models', 'all-for-validation'] })
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) =>
      updateModel(id, { status } as Record<string, unknown> as Partial<ModelForm>),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '操作失败'); return }
      queryClient.invalidateQueries({ queryKey: ['models'] })
      queryClient.invalidateQueries({ queryKey: ['models', 'all-for-validation'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const handleSubmit = (values: FormValues) => {
    // Strip /v1/ prefix from endpoint values — frontend displays full URL paths
    // but the backend validates bare endpoint types like "chat/completions".
    const cleanEndpoints = (values.endpoints ?? []).map((ep) =>
      ep.startsWith('/v1/') ? ep.slice(4) : ep,
    )

    const payload: Record<string, unknown> = {
      model_name: values.model_name,
      type: values.type,
      display_name: values.display_name || undefined,
      upstream_name: values.upstream_name || undefined,
      channel_ids: values.channel_ids ?? [],
      capabilities: values.capabilities ?? [],
      endpoints: cleanEndpoints,
      context_window: values.context_window || undefined,
      max_output_tokens: values.max_output_tokens || undefined,
      match_rule: values.match_rule,
    }

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, values: payload as unknown as Partial<ModelForm> })
    } else {
      createMutation.mutate(payload as unknown as ModelForm)
    }
  }

  const handleFetchUpstreamModels = useCallback(async () => {
    const ids: number[] = form.getFieldValue('channel_ids') || []
    if (ids.length === 0) {
      message.warning('请先选择上游渠道')
      return
    }
    setFetchingModels(true)
    try {
      const allModels: string[] = []
      const allDetails: Record<string, { type?: string; capabilities?: string[] }> = {}
      let failedCount = 0
      for (const id of ids) {
        try {
          const payload = await fetchChannelModels(id)
          if (payload.data?.models) {
            allModels.push(...payload.data.models)
          }
          if (payload.data?.details) {
            for (const d of payload.data.details) {
              allDetails[d.model_name] = {
                type: d.type,
                capabilities: d.capabilities,
              }
            }
          }
        } catch {
          failedCount++
        }
      }
      if (failedCount > 0) {
        message.warning(`${failedCount} 个渠道拉取失败`)
      }
      const unique = [...new Set(allModels)].sort()
      setUpstreamModels(unique)
      setUpstreamDetails((prev) => ({ ...prev, ...allDetails }))
      if (unique.length === 0) {
        message.info('所选渠道未返回模型名')
      } else {
        message.success(`获取到 ${unique.length} 个模型名`)
      }
    } catch {
      message.error('获取模型名失败')
    } finally {
      setFetchingModels(false)
    }
  }, [form, message])

  const handleOpenModal = () => {
    setEditingId(null)
    editingModelIdRef.current = null
    setUpstreamModels([])
    setUpstreamDetails({})
    form.setFieldsValue(defaultFormValues)
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleEdit = async (record: Model) => {
    setEditingId(record.id)
    editingModelIdRef.current = record.id
    let channelIds: number[] = []
    try {
      const { data: modelChannelsData } = await listModelChannels(record.id)
      channelIds = [...new Set((modelChannelsData ?? []).map((c: ModelChannel) => c.id))]
    } catch {
      message.warning('无法加载渠道关联信息')
    }
    form.setFieldsValue({
      model_name: record.model_name,
      display_name: record.display_name ?? '',
      upstream_name: record.upstream_name ?? '',
      type: record.type,
      channel_ids: channelIds,
      capabilities: record.capabilities || [],
      endpoints: (record.endpoints || []).map((ep: string) =>
        ep.startsWith('/v1/') ? ep : `/v1/${ep}`,
      ),
      context_window: record.context_window,
      max_output_tokens: record.max_output_tokens,
      match_rule: record.match_rule,
      status: record.status,
    })
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (!closeForceRef.current && dirty()) {
      Modal.confirm({
        title: '确认关闭',
        content: '有未保存的修改，确定要关闭吗？',
        onOk: () => {
          setIsModalOpen(false)
          setEditingId(null)
          editingModelIdRef.current = null
          form.resetFields()
        },
      })
    } else {
      closeForceRef.current = false
      setIsModalOpen(false)
      setEditingId(null)
      editingModelIdRef.current = null
      form.resetFields()
    }
  }

  const handleRowClick = async (record: Model) => {
    setDetailModel(record)
    setDrawerOpen(true)
    setDetailLoading(true)
    try {
      const res = await getModel(record.id)
      if (res.code === 0 && res.data) {
        setDetailModel(res.data)
      }
    } catch {
      message.warning('获取模型详情失败，显示列表缓存数据')
    } finally {
      setDetailLoading(false)
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '模型名',
      dataIndex: 'model_name',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: '上游模型名',
      dataIndex: 'upstream_name',
      width: 160,
      render: (name?: string) => name || <Typography.Text type="secondary">-</Typography.Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      render: (type: string) => <ModelTypeBadge type={type} />,
    },
    {
      title: '能力',
      key: 'capabilities',
      width: 180,
      render: (_: unknown, record: Model) => (
        <CapabilityTags capabilities={record.capabilities} />
      ),
    },
    {
      title: '匹配',
      dataIndex: 'match_rule',
      width: 70,
      render: (rule: number) => (
        <Tag>{MATCH_RULE_LABELS[rule] ?? rule}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 70,
      render: (status: number, record: Model) => (
        <Popconfirm
          title={`确定要${status === 1 ? '禁用' : '启用'}该模型吗？`}
          onConfirm={() => toggleMutation.mutate({ id: record.id, status: status === 1 ? 0 : 1 })}
        >
          <Switch
            checked={status === 1}
            size="small"
            loading={toggleMutation.isPending && toggleMutation.variables?.id === record.id}
          />
        </Popconfirm>
      ),
    },
    {
      title: '定价',
      dataIndex: 'has_pricing',
      width: 80,
      render: (val: boolean) =>
        val ? <Tag color="green">已定价</Tag> : <Tag color="default">未定价</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Model) => (
        <Space size="small">
          <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleEdit(record) }}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除模型 "${record.model_name}" 吗？`}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              size="small"
              loading={deleteMutation.isPending && deleteMutation.variables === record.id}
              onClick={(e) => e.stopPropagation()}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const modalTitle = editingId !== null ? '编辑模型' : '新增模型'
  const submitLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <Space>
          <Input.Search
            placeholder="搜索模型名"
            onSearch={(v) => { setKeyword(v); setPage(1) }}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="按渠道筛选"
            allowClear
            style={{ width: 200 }}
            value={channelId}
            onChange={(value) => { setChannelId(value); setPage(1) }}
            options={(channelsData?.data?.data || []).map((c: Channel) => ({
              value: c.id,
              label: `${c.name}`,
            }))}
          />
        </Space>
        <Space>
          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val as 'list' | 'matrix')}
            options={[
              { value: 'list', label: '列表' },
              { value: 'matrix', label: '矩阵' },
            ]}
          />
          <Button type="primary" onClick={handleOpenModal}>
            新增模型
          </Button>
        </Space>
      </div>

      {viewMode === 'list' ? (
        <>
          {!isLoading && (data?.data?.data || []).length === 0 ? (
            <EmptyState
              description="暂无模型数据"
              actionText="新增模型"
              onAction={handleOpenModal}
            />
          ) : (
            <>
              {selectedRowKeys.length > 0 && (
                <Space style={{ marginBottom: 16 }}>
                  <span>已选 {selectedRowKeys.length} 项</span>
                  <Button onClick={() => { setBatchCapabilities([]); setBatchCapModalOpen(true) }}>
                    批量设置能力
                  </Button>
                  <Popconfirm
                    title="确认批量删除"
                    description={`确定删除选中的 ${selectedRowKeys.length} 个模型吗？`}
                    onConfirm={handleBatchDelete}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button danger loading={batchDeleting}>批量删除</Button>
                  </Popconfirm>
                </Space>
              )}
              <Table
                scroll={{ x: 'max-content' }}
                loading={isLoading}
                dataSource={data?.data?.data || []}
                rowKey="id"
                size="middle"
                onRow={(record) => ({
                  onClick: () => handleRowClick(record),
                  style: { cursor: 'pointer' },
                })}
                pagination={{
                  current: page,
                  pageSize: 20,
                  total: data?.data?.pagination?.total || 0,
                  onChange: setPage,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                columns={columns}
                rowSelection={{
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys),
                }}
              />
            </>
          )}
        </>
      ) : (
        <ModelCapabilityMatrix
          models={data?.data?.data || []}
          loading={isLoading}
        />
      )}

      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={handleCloseModal}
        onOk={async () => { try { await form.submit() } catch { /* validation failed, Ant Design shows inline errors */ } }}
        confirmLoading={submitLoading}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={defaultFormValues}>
          <Form.Item
            label="模型名称"
            name="model_name"
            rules={[
              { required: true, message: '请输入模型名称' },
              {
                validator: (_, value) => {
                  if (value && existingModels.has(value)) {
                    const existingId = existingModels.get(value)
                    // 编辑时允许保留当前模型自己的名称
                    if (existingId !== editingModelIdRef.current) {
                      return Promise.reject(new Error(`模型已存在 (ID: ${existingId})`))
                    }
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <AutoComplete
              placeholder="gpt-4o"
              options={upstreamModels.map((m) => {
                const detail = upstreamDetails[m]
                const caps = detail?.capabilities?.map((c) => CAPABILITY_LABELS[c] ?? c).join(', ') ?? ''
                return {
                  value: m,
                  label: existingModels.has(m) && existingModels.get(m) !== editingId
                    ? `${m} (已存在)`
                    : m,
                  caps,
                }
              })}
              onSelect={(value) => {
                const detail = upstreamDetails[value]
                if (detail) {
                  // 延迟一帧确保 model_name 先写入
                  if (timeoutRef.current) clearTimeout(timeoutRef.current)
                  timeoutRef.current = setTimeout(() => {
                    if (detail.type) form.setFieldValue('type', detail.type)
                    if (detail.capabilities) form.setFieldValue('capabilities', detail.capabilities)
                  }, 0)
                }
              }}
              filterOption={(input, option) =>
                (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              <Input
                suffix={
                  <Button
                    type="link"
                    size="small"
                    loading={fetchingModels}
                    onClick={handleFetchUpstreamModels}
                    style={{ padding: 0 }}
                  >
                    获取模型名
                  </Button>
                }
              />
            </AutoComplete>
          </Form.Item>

          <Form.Item label="显示名称" name="display_name">
            <Input placeholder="可选" />
          </Form.Item>

          <Form.Item label="上游模型名" name="upstream_name" tooltip="转发到上游渠道时使用的模型名。留空则使用模型名本身。例如模型名为 juhe-gpt-image-2，上游模型名设为 gpt-image-2">
            <Input placeholder="可选，如 gpt-image-2" />
          </Form.Item>

          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={MODEL_TYPES} />
          </Form.Item>

          <Form.Item label="能力" name="capabilities">
            <CapabilitySelector />
          </Form.Item>

          <Form.Item label="端点" name="endpoints">
            <Select
              mode="tags"
              placeholder="选择或输入端点和路径"
              tokenSeparators={[',']}
              options={ENDPOINT_OPTIONS.map((v) => ({ value: v, label: v }))}
            />
          </Form.Item>

          <Form.Item label="上游渠道" name="channel_ids">
            <Select
              mode="multiple"
              placeholder="选择关联的渠道"
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={(channelsData?.data?.data ?? []).map((c: Channel) => ({
                value: c.id,
                label: `${c.name} (${c.type})`,
              }))}
            />
          </Form.Item>

          <Form.Item label="上下文窗口" name="context_window">
            <InputNumber min={0} placeholder="如 128000" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="最大输出 Token" name="max_output_tokens">
            <InputNumber min={0} placeholder="如 4096" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="匹配规则" name="match_rule">
            <Select options={MATCH_RULE_OPTIONS} />
          </Form.Item>

          <Form.Item label="状态" name="status">
            <Select options={[
              { value: 0, label: '禁用' },
              { value: 1, label: '启用' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <ModelDetailDrawer
        open={drawerOpen}
        model={detailModel}
        loading={detailLoading}
        onClose={() => setDrawerOpen(false)}
      />

      <Modal
        title={`批量设置能力（已选 ${selectedRowKeys.length} 个模型）`}
        open={batchCapModalOpen}
        onCancel={() => setBatchCapModalOpen(false)}
        onOk={handleBatchSetCapabilities}
        confirmLoading={batchCapSaving}
      >
        <div style={{ marginBottom: 8 }}>
          <CapabilitySelector value={batchCapabilities} onChange={setBatchCapabilities} />
        </div>
        <Typography.Text type="secondary">
          将为选中的 {selectedRowKeys.length} 个模型统一设置以上能力
        </Typography.Text>
      </Modal>
    </div>
  )
}
