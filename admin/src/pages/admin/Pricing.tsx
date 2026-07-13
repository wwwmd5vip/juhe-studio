import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  App,
  Popconfirm,
  Tag,
  Typography,
  Alert,
  Radio,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listPricing,
  createPricing,
  updatePricing,
  deletePricing,
  batchCreatePricing,
  syncUpstreamPricing,
  syncPresetPricing,
  type Pricing,
  type PricingForm,
  type BatchPricingItem,
} from '../../api/pricing'
import { listModels } from '../../api/model'
import { listChannels, type Channel } from '../../api/channel'
import { useThemeStore } from '../../stores/themeStore'
import { BILLING_MODE_COLORS } from '../../styles/channel-colors'
import EmptyState from '../../components/EmptyState'

const BILLING_MODE_OPTIONS = [
  { value: 'token', label: 'Token 计费' },
  { value: 'fixed', label: '固定价格' },
  { value: 'tiered', label: '阶梯计费' },
]

const defaultFormValues: PricingForm = {
  model_name: '',
  group: '',
  billing_mode: 'token',
  model_ratio: 0,
  completion_ratio: 0,
  cached_tokens_ratio: 0,
  fixed_price_cents: 0,
  image_ratio: 0,
  tiered_expr: '',
}

function BillingModeFields({ mode }: { mode: string }) {
  if (mode === 'token') {
    return (
      <Space size="large" style={{ display: 'flex' }}>
        <Form.Item
          label="模型倍率"
          name="model_ratio"
          rules={[{ required: true, message: '请输入模型倍率' }]}
        >
          <InputNumber min={0} step={0.01} style={{ width: 140 }} />
        </Form.Item>
        <Form.Item label="补全倍率" name="completion_ratio">
          <InputNumber min={0} step={0.01} style={{ width: 140 }} />
        </Form.Item>
        <Form.Item label="缓存倍率" name="cached_tokens_ratio">
          <InputNumber min={0} step={0.01} style={{ width: 140 }} />
        </Form.Item>
      </Space>
    )
  }

  if (mode === 'fixed') {
    return (
      <Space size="large" style={{ display: 'flex' }}>
        <Form.Item
          label="固定价格(分)"
          name="fixed_price_cents"
          rules={[{ required: true, message: '请输入固定价格' }]}
        >
          <InputNumber min={1} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item label="图像倍率" name="image_ratio">
          <InputNumber min={0} step={0.01} style={{ width: 160 }} />
        </Form.Item>
      </Space>
    )
  }

  if (mode === 'tiered') {
    return (
      <Form.Item label="阶梯表达式 (Alpha)" name="tiered_expr">
        <Input.TextArea rows={4} placeholder="阶梯计费表达式" />
      </Form.Item>
    )
  }

  return null
}

/** Billing mode colored tag (参考 sub2api-cnb PricingEntryCard) */
function BillingModeTag({ mode }: { mode: string }) {
  const color = BILLING_MODE_COLORS[mode] ?? '#8c8c8c'
  const labels: Record<string, string> = { token: 'Token', fixed: 'Fixed', tiered: 'Tiered' }
  return <Tag color={color}>{labels[mode] ?? mode}</Tag>
}

/** Compact price display */
function PriceCell({ pricing }: { pricing: Pricing }) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  if (pricing.billing_mode === 'token') {
    return (
      <Typography.Text>
        <span style={{ fontWeight: 500 }}>{pricing.model_ratio}</span>
        {pricing.completion_ratio ? (
          <span style={{ color: isDark ? '#666' : '#8c8c8c' }}> / {pricing.completion_ratio}</span>
        ) : null}
        {pricing.cached_tokens_ratio !== undefined && pricing.cached_tokens_ratio !== pricing.model_ratio ? (
          <span style={{ color: isDark ? '#666' : '#8c8c8c' }}> / {pricing.cached_tokens_ratio}</span>
        ) : null}
        <span style={{ color: isDark ? '#666' : '#8c8c8c', fontSize: 12 }}> (倍率)</span>
      </Typography.Text>
    )
  }
  if (pricing.billing_mode === 'fixed') {
    return (
      <Typography.Text>
        <span style={{ fontWeight: 500 }}>{pricing.fixed_price_cents}</span>
        <span style={{ color: isDark ? '#666' : '#8c8c8c', fontSize: 12 }}> 分/次</span>
      </Typography.Text>
    )
  }
  return <Typography.Text type="secondary">阶梯</Typography.Text>
}

export default function PricingPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [modelName, setModelName] = useState('')
  const [group, setGroup] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm<PricingForm>()
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

  // Batch pricing state
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchModel, setBatchModel] = useState('')
  const [batchOverwrite, setBatchOverwrite] = useState(false)
  const [batchItems, setBatchItems] = useState<BatchPricingItem[]>([])

  // Sync upstream pricing state
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncChannelId, setSyncChannelId] = useState<number | undefined>(undefined)

  const GROUPS = ['default', 'vip', 'premium', 'internal', 'trial']

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pricing', page, modelName, group],
    queryFn: () => listPricing(page, 20, modelName, group),
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

  const { data: modelsData } = useQuery({
    queryKey: ['models-for-pricing'],
    queryFn: () => listModels(1, 500),
    staleTime: 60000,
  })
  const availableModelNames = Array.from(
    new Set((modelsData?.data?.data ?? []).map((m) => m.model_name))
  ).sort()

  const createMutation = useMutation({
    mutationFn: createPricing,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '创建失败'); return }
      message.success('创建成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<PricingForm> }) =>
      updatePricing(id, values),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '更新失败'); return }
      message.success('更新成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePricing,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '删除失败'); return }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const batchMutation = useMutation({
    mutationFn: () => batchCreatePricing(batchModel, batchItems, batchOverwrite),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '批量定价设置失败'); return }
      message.success('批量定价设置成功')
      setBatchModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels-for-sync'],
    queryFn: () => listChannels(1, 500),
    staleTime: 60000,
  })
  const channels: Channel[] = channelsData?.data?.data ?? []

  const syncMutation = useMutation({
    mutationFn: syncUpstreamPricing,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '同步失败'); return }
      message.success(res.message || `同步成功 ${res.data?.synced ?? 0} 条定价`)
      setSyncModalOpen(false)
      setSyncChannelId(undefined)
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const presetMutation = useMutation({
    mutationFn: syncPresetPricing,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '同步失败'); return }
      message.success(res.message || `同步成功 ${res.data?.synced ?? 0} 条定价`)
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const handleSubmit = (values: PricingForm) => {
    if (editingId !== null) updateMutation.mutate({ id: editingId, values })
    else createMutation.mutate(values)
  }

  const handleOpenModal = () => {
    setEditingId(null)
    form.setFieldsValue(defaultFormValues)
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleEdit = (record: Pricing) => {
    setEditingId(record.id)
    form.setFieldsValue({
      model_name: record.model_name,
      group: record.group,
      billing_mode: record.billing_mode,
      model_ratio: record.model_ratio,
      completion_ratio: record.completion_ratio,
      cached_tokens_ratio: record.cached_tokens_ratio ?? 0,
      fixed_price_cents: record.fixed_price_cents ?? 0,
      image_ratio: record.image_ratio,
      tiered_expr: record.tiered_expr ?? '',
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
          form.resetFields()
        },
      })
    } else {
      closeForceRef.current = false
      setIsModalOpen(false)
      setEditingId(null)
      form.resetFields()
    }
  }

  const handleOpenBatch = () => {
    setBatchModel('')
    setBatchItems(GROUPS.map(g => ({ group: g, billing_mode: 'token', model_ratio: 1, completion_ratio: 1, cached_tokens_ratio: 1 })))
    setBatchOverwrite(false)
    setBatchModalOpen(true)
  }

  const handleModelSelect = async (val: string) => {
    setBatchModel(val)
    try {
      const res = await listPricing(1, 50, val, '')
      if (res.code === 0 && res.data?.data) {
        const existing = res.data.data
        setBatchItems(GROUPS.map(g => {
          const found = existing.find(p => p.group === g)
          return found
            ? { group: g, billing_mode: found.billing_mode, model_ratio: found.model_ratio || 1, completion_ratio: found.completion_ratio || 1, cached_tokens_ratio: found.cached_tokens_ratio ?? 1, fixed_price_cents: found.fixed_price_cents, image_ratio: found.image_ratio }
            : { group: g, billing_mode: 'token', model_ratio: 1, completion_ratio: 1, cached_tokens_ratio: 1 }
        }))
      }
    } catch { /* ignore prefill failures */ }
  }

  const updateBatchItem = (group: string, field: string, value: unknown) => {
    setBatchItems(prev => prev.map(item => item.group === group ? { ...item, [field]: value } : item))
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '模型名',
      dataIndex: 'model_name',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: '分组',
      dataIndex: 'group',
      width: 100,
      render: (g: string) => (
        <Tag color={g === 'default' ? 'blue' : 'purple'}>{g}</Tag>
      ),
    },
    {
      title: '模式',
      dataIndex: 'billing_mode',
      width: 90,
      render: (mode: string) => <BillingModeTag mode={mode} />,
    },
    {
      title: '价格',
      key: 'price',
      width: 130,
      render: (_: unknown, record: Pricing) => <PriceCell pricing={record} />,
    },
    {
      title: '生效时间',
      width: 130,
      render: (d: string) => (d ? new Date(d).toLocaleDateString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Pricing) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定删除该定价吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger size="small" loading={deleteMutation.isPending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const modalTitle = editingId !== null ? '编辑定价' : '新增定价'
  const submitLoading = createMutation.isPending || updateMutation.isPending
  const watchedBillingMode = Form.useWatch('billing_mode', form)
  const watchedModelRatio = Form.useWatch('model_ratio', form)
  const watchedCompletionRatio = Form.useWatch('completion_ratio', form)
  const watchedCachedRatio = Form.useWatch('cached_tokens_ratio', form)
  const watchedFixedPrice = Form.useWatch('fixed_price_cents', form)
  const watchedTieredExpr = Form.useWatch('tiered_expr', form)

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input.Search
            placeholder="搜索模型名"
            onSearch={(value) => { setModelName(value); setPage(1); }}
            allowClear
            style={{ width: 200 }}
          />
          <Input.Search
            placeholder="搜索分组"
            onSearch={(value) => { setGroup(value); setPage(1); }}
            allowClear
            style={{ width: 180 }}
          />
        </Space>
        <Button type="primary" onClick={handleOpenModal}>
          新增定价
        </Button>
        <Button onClick={handleOpenBatch}>批量设置定价</Button>
        <Button onClick={() => setSyncModalOpen(true)}>同步上游定价</Button>
        <Button onClick={() => presetMutation.mutate('models.dev')} loading={presetMutation.isPending}>
          同步 models.dev
        </Button>
      </div>

      <Table
        scroll={{ x: 'max-content' }}
        loading={isLoading}
        dataSource={data?.data?.data || []}
        rowKey="id"
        size="middle"
        locale={{ emptyText: <EmptyState title="暂无定价规则" description="为模型设置定价策略，控制成本与收益" actionText="添加定价" onAction={handleOpenModal} /> }}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.data?.pagination?.total || 0,
          onChange: setPage,
          showTotal: (total) => `共 ${total} 条`,
        }}
        columns={columns}
      />

      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={handleCloseModal}
        onOk={async () => { try { await form.submit() } catch { /* validation failed, Ant Design shows inline errors */ } }}
        confirmLoading={submitLoading}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={defaultFormValues}>
          <Form.Item
            label="模型名称"
            name="model_name"
            rules={[{ required: true, message: '请选择或输入模型名称' }]}
          >
            <Select
              showSearch
              placeholder="选择模型或输入名称"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={availableModelNames.map((name) => ({ value: name, label: name }))}
            />
          </Form.Item>

          <Form.Item label="分组" name="group" rules={[{ required: true, message: '请选择分组' }]}>
            <Select
              showSearch
              placeholder="选择或输入分组名"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={[
                { value: 'default', label: 'default' },
                { value: 'vip', label: 'vip' },
                { value: 'premium', label: 'premium' },
                { value: 'internal', label: 'internal' },
                { value: 'trial', label: 'trial' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="计费模式"
            name="billing_mode"
            rules={[{ required: true, message: '请选择计费模式' }]}
          >
            <Select options={BILLING_MODE_OPTIONS} />
          </Form.Item>

          <BillingModeFields mode={watchedBillingMode || 'token'} />

          {watchedBillingMode === 'token' && watchedModelRatio !== undefined && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={
                <span>
                  示例：1K prompt token = <strong>¥{((watchedModelRatio ?? 0) * 0.002).toFixed(4)}</strong>
                  {watchedCompletionRatio !== undefined && (
                    <span>，1K completion token = <strong>¥{((watchedCompletionRatio ?? 0) * 0.002).toFixed(4)}</strong></span>
                  )}
                  {watchedCachedRatio !== undefined && (
                    <span>，1K 缓存命中 token = <strong>¥{((watchedCachedRatio ?? 0) * 0.002).toFixed(4)}</strong></span>
                  )}
                </span>
              }
            />
          )}

          {watchedBillingMode === 'fixed' && watchedFixedPrice !== undefined && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={
                <span>
                  示例：单次请求固定费用 <strong>¥{((watchedFixedPrice ?? 0) / 100).toFixed(2)}</strong>
                </span>
              }
            />
          )}

          {watchedBillingMode === 'tiered' && watchedTieredExpr && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={
                <span>
                  按阶梯表达式计费：<strong>{watchedTieredExpr}</strong>
                </span>
              }
            />
          )}
        </Form>
      </Modal>

      <Modal
        title="批量设置定价"
        open={batchModalOpen}
        onCancel={() => setBatchModalOpen(false)}
        onOk={() => batchMutation.mutate()}
        confirmLoading={batchMutation.isPending}
        width={700}
        okText="提交"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Select
            showSearch
            placeholder="选择模型"
            value={batchModel || undefined}
            onChange={handleModelSelect}
            options={availableModelNames.map((name) => ({ value: name, label: name }))}
            style={{ width: '100%' }}
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
          <Table
            dataSource={batchItems}
            rowKey="group"
            size="small"
            pagination={false}
            columns={[
              { title: '分组', dataIndex: 'group', width: 100,
                render: (g: string) => <Tag color={g === 'default' ? 'blue' : 'purple'}>{g}</Tag> },
              { title: '计费模式', dataIndex: 'billing_mode', width: 110,
                render: (mode: string, record: BatchPricingItem) => (
                  <Select value={mode} onChange={v => updateBatchItem(record.group, 'billing_mode', v)} size="small" style={{ width: 90 }}
                    options={[
                      { value: 'token', label: 'token' },
                      { value: 'fixed', label: 'fixed' },
                      { value: 'tiered', label: 'tiered' },
                    ]}
                  />
                )},
              { title: '模型倍率', dataIndex: 'model_ratio', width: 110,
                render: (v: number, record: BatchPricingItem) => (
                  <InputNumber value={v} onChange={val => updateBatchItem(record.group, 'model_ratio', val)} size="small" min={0} step={0.1} style={{ width: 90 }} />
                )},
              { title: '补全倍率', dataIndex: 'completion_ratio', width: 110,
                render: (v: number, record: BatchPricingItem) => (
                  <InputNumber value={v} onChange={val => updateBatchItem(record.group, 'completion_ratio', val)} size="small" min={0} step={0.1} style={{ width: 90 }} />
                )},
              { title: '缓存倍率', dataIndex: 'cached_tokens_ratio', width: 110,
                render: (v: number, record: BatchPricingItem) => (
                  <InputNumber value={v} onChange={val => updateBatchItem(record.group, 'cached_tokens_ratio', val)} size="small" min={0} step={0.1} style={{ width: 90 }} />
                )},
            ]}
          />
          <Radio.Group value={batchOverwrite} onChange={e => setBatchOverwrite(e.target.value)}>
            <Radio value={false}>仅补充缺失（已存在的不覆盖）</Radio>
            <Radio value={true}>覆盖已有定价</Radio>
          </Radio.Group>
        </Space>
      </Modal>

      <Modal
        title="同步上游定价"
        open={syncModalOpen}
        onCancel={() => { setSyncModalOpen(false); setSyncChannelId(undefined) }}
        onOk={() => syncChannelId && syncMutation.mutate(syncChannelId)}
        confirmLoading={syncMutation.isPending}
        okText="开始同步"
        okButtonProps={{ disabled: !syncChannelId }}
      >
        <div style={{ marginBottom: 8 }}>
          选择一个已配置的上游渠道，从该渠道拉取定价数据，仅同步本地已有的模型。
        </div>
        <Select
          showSearch
          placeholder="选择上游渠道"
          value={syncChannelId}
          onChange={setSyncChannelId}
          style={{ width: '100%' }}
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          options={channels.map((ch) => ({
            value: ch.id,
            label: `${ch.name} (${ch.type})`,
          }))}
        />
      </Modal>
    </div>
  )
}
