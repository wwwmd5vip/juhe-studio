import { useState, useMemo, useRef } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Tabs, Space, Tag, App, Popconfirm, Switch, Select, Alert } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  listUserSubscriptions,
  type SubscriptionPlan,
  type SubscriptionPlanForm,
} from '../../api/subscription'
import { useFinanceContext } from '../../contexts/FinanceContext'
import EmptyState from '../../components/EmptyState'

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '禁用', color: 'red' },
  1: { label: '启用', color: 'green' },
}

const STATUS_OPTIONS = [
  { value: 0, label: '禁用' },
  { value: 1, label: '启用' },
]

const SUBSCRIPTION_STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '已取消', color: 'default' },
  1: { label: '生效中', color: 'green' },
}

const defaultPlanValues: SubscriptionPlanForm = {
  name: '',
  quota_value: 0,
  price_cents: 0,
  currency: 'CNY',
  interval_months: 1,
  sort_order: 0,
}

export default function Subscriptions() {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const { openFinanceDrawer } = useFinanceContext()
  const [activeTab, setActiveTab] = useState('plans')

  const [planPage, setPlanPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [form] = Form.useForm<SubscriptionPlanForm & { status?: number }>()
  const initialValuesRef = useRef('')
  const closeForceRef = useRef(false)

  const [subPage, setSubPage] = useState(1)
  const [subUserId, setSubUserId] = useState('')

  const plansQuery = useQuery({
    queryKey: ['subscriptionPlans', planPage],
    queryFn: () => listSubscriptionPlans(planPage, 20),
    enabled: activeTab === 'plans',
  })

  const createMutation = useMutation({
    mutationFn: createSubscriptionPlan,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '创建失败')
        return
      }
      message.success('创建成功')
      closeForceRef.current = true
      closeModal()
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: SubscriptionPlanForm & { status?: number } }) =>
      updateSubscriptionPlan(id, values),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '更新失败')
        return
      }
      message.success('更新成功')
      closeForceRef.current = true
      closeModal()
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSubscriptionPlan,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const statusToggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) =>
      updateSubscriptionPlan(id, { status } as SubscriptionPlanForm & { status?: number }),
    onSuccess: (res, variables) => {
      if (res.code !== 0) {
        message.error(res.message || '操作失败')
        return
      }
      message.success(`已${variables.status === 1 ? '启用' : '禁用'}`)
      queryClient.invalidateQueries({ queryKey: ['subscriptionPlans'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
    onSettled: () => {
      setTogglingId(null)
    },
  })

  const parsedSubUserId = (() => {
    const n = Number(subUserId)
    if (!subUserId || Number.isNaN(n) || n <= 0) return undefined
    return n
  })()

  const subsQuery = useQuery({
    queryKey: ['userSubscriptions', subPage, parsedSubUserId],
    queryFn: () => listUserSubscriptions(subPage, 20, parsedSubUserId),
    enabled: activeTab === 'subscriptions',
  })

  if (plansQuery.isError || subsQuery.isError) {
    const err = plansQuery.error || subsQuery.error
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

  const subColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户ID', dataIndex: 'user_id' },
    { title: '套餐ID', dataIndex: 'plan_id' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: number) => {
        const info = SUBSCRIPTION_STATUS_MAP[status]
        return info ? <Tag color={info.color}>{info.label}</Tag> : status
      },
    },
    { title: '开始时间', dataIndex: 'started_at' },
    { title: '过期时间', dataIndex: 'expires_at' },
    {
      title: '上次扣费',
      dataIndex: 'last_billed_at',
      render: (value?: string) => value || '-',
    },
  ]

  const displaySubColumns = useMemo(() => subColumns.map(col =>
    col.dataIndex === 'user_id'
      ? { ...col, render: (id: number) => <a onClick={() => openFinanceDrawer(id)} style={{ cursor: 'pointer' }}>{id}</a> }
      : col
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [openFinanceDrawer])

  const closeModal = () => {
    if (closeForceRef.current) {
      closeForceRef.current = false
      setIsModalOpen(false)
      setEditingId(null)
      form.resetFields()
      return
    }
    const current = JSON.stringify(form.getFieldsValue())
    if (current !== initialValuesRef.current) {
      modal.confirm({
        title: '确认关闭',
        content: '有未保存的修改，确定要关闭吗？',
        onOk: () => {
          form.resetFields()
          setIsModalOpen(false)
          setEditingId(null)
        },
      })
    } else {
      form.resetFields()
      setIsModalOpen(false)
      setEditingId(null)
    }
  }

  const handleSubmit = (values: SubscriptionPlanForm & { status?: number }) => {
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleEdit = (record: SubscriptionPlan) => {
    closeForceRef.current = false
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      quota_value: record.quota_value,
      price_cents: record.price_cents,
      currency: record.currency,
      interval_months: record.interval_months,
      sort_order: record.sort_order,
      status: record.status,
    })
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleStatusToggle = (record: SubscriptionPlan) => {
    const newStatus = record.status === 1 ? 0 : 1
    setTogglingId(record.id)
    statusToggleMutation.mutate({ id: record.id, status: newStatus })
  }

  const planColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    { title: '额度', dataIndex: 'quota_value' },
    {
      title: '价格',
      dataIndex: 'price_cents',
      render: (v: number) => (v / 100).toFixed(2) + '元',
    },
    { title: '货币', dataIndex: 'currency' },
    { title: '周期(月)', dataIndex: 'interval_months' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: number, record: SubscriptionPlan) => (
        <Space size="small">
          <Tag color={STATUS_MAP[status]?.color ?? 'default'}>{STATUS_MAP[status]?.label ?? status}</Tag>
          <Popconfirm
            title={`确定要${status === 1 ? '禁用' : '启用'}该套餐吗？`}
            onConfirm={() => handleStatusToggle(record)}
          >
            <Switch
              checked={status === 1}
              size="small"
              loading={togglingId === record.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
    { title: '排序', dataIndex: 'sort_order' },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: SubscriptionPlan) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除套餐 "${record.name}" 吗？`}
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

  const modalTitle = editingId !== null ? '编辑订阅套餐' : '新增订阅套餐'
  const submitLoading = createMutation.isPending || updateMutation.isPending

  const tabItems = [
    {
      key: 'plans',
      label: '订阅套餐',
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={() => {
              closeForceRef.current = false
              setEditingId(null)
              form.resetFields()
              form.setFieldsValue(defaultPlanValues)
              setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
              setIsModalOpen(true)
            }}>
              新增套餐
            </Button>
          </div>

          <Table
            size="middle"
            loading={plansQuery.isLoading}
            dataSource={plansQuery.data?.data?.data || []}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <EmptyState title="暂无订阅套餐" description="创建订阅套餐，为用户提供周期性AI服务" actionText="创建套餐" onAction={() => setIsModalOpen(true)} /> }}
            pagination={{
              current: planPage,
              pageSize: 20,
              total: plansQuery.data?.data?.pagination?.total || 0,
              onChange: setPlanPage,
              showTotal: (total: number) => `共 ${total} 条`,
            }}
            columns={planColumns}
          />
        </>
      ),
    },
    {
      key: 'subscriptions',
      label: '用户订阅',
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Input.Search
                placeholder="用户ID"
                onSearch={(v) => {
                  setSubUserId(v)
                  setSubPage(1)
                }}
                style={{ width: 200 }}
                allowClear
              />
              <Button type="primary" onClick={() => setSubPage(1)}>
                查询
              </Button>
            </Space>
          </div>

          <Table
            size="middle"
            loading={subsQuery.isLoading}
            dataSource={subsQuery.data?.data?.data || []}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <EmptyState description="暂无订阅记录" /> }}
            pagination={{
              current: subPage,
              pageSize: 20,
              total: subsQuery.data?.data?.pagination?.total || 0,
              onChange: setSubPage,
              showTotal: (total: number) => `共 ${total} 条`,
            }}
            columns={displaySubColumns}
          />
        </>
      ),
    },
  ]

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={async () => {
          try { await form.submit() } catch { /* validation failed */ }
        }}
        confirmLoading={submitLoading}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={defaultPlanValues}
        >
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：月度会员" />
          </Form.Item>

          <Space size="large" style={{ display: 'flex' }}>
            <Form.Item
              label="额度"
              name="quota_value"
              rules={[
                { required: true, message: '请输入额度' },
                { type: 'number', min: 1, message: '额度必须大于 0' },
              ]}
            >
              <InputNumber min={1} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item
              label="价格(分)"
              name="price_cents"
              rules={[{ required: true, message: '请输入价格' }]}
            >
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
          </Space>

          <Space size="large" style={{ display: 'flex' }}>
            <Form.Item
              label="货币"
              name="currency"
              rules={[{ required: true, message: '请输入货币' }]}
            >
              <Input placeholder="CNY" maxLength={8} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item
              label="周期(月)"
              name="interval_months"
              rules={[{ required: true, message: '请输入周期' }]}
            >
              <InputNumber min={1} style={{ width: 160 }} />
            </Form.Item>
          </Space>

          <Form.Item label="排序" name="sort_order">
            <InputNumber style={{ width: 160 }} />
          </Form.Item>

          {editingId !== null && (
            <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
              <Select options={STATUS_OPTIONS} placeholder="选择状态" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
