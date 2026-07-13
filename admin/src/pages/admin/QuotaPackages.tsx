import { useState, useRef } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, App, Popconfirm, Tag, Switch, Alert } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listQuotaPackages,
  createQuotaPackage,
  updateQuotaPackage,
  deleteQuotaPackage,
  batchUpdateQuotaPackageStatus,
  batchDeleteQuotaPackage,
  type QuotaPackage,
  type QuotaPackageForm,
} from '../../api/quotaPackage'
import EmptyState from '../../components/EmptyState'

const formatNumber = (v: number) => v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toLocaleString()
const formatPrice = (v: number) => (v / 100).toFixed(2) + '元'

const STATUS_MAP: Record<number, string> = {
  0: '禁用',
  1: '启用',
}

const STATUS_OPTIONS = [
  { value: 0, label: '禁用' },
  { value: 1, label: '启用' },
]

const defaultFormValues: QuotaPackageForm = {
  name: '',
  quota_value: 0,
  price_cents: 0,
  currency: 'CNY',
  sort_order: 0,
}

export default function QuotaPackages() {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [form] = Form.useForm<QuotaPackageForm & { status?: number }>()
  const initialValuesRef = useRef('')
  const closeForceRef = useRef(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['quotaPackages', page, keyword],
    queryFn: () => listQuotaPackages(page, 20, keyword),
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

  const createMutation = useMutation({
    mutationFn: createQuotaPackage,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '创建失败')
        return
      }
      message.success('创建成功')
      closeForceRef.current = true
      closeModal()
      queryClient.invalidateQueries({ queryKey: ['quotaPackages'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: QuotaPackageForm & { status?: number } }) =>
      updateQuotaPackage(id, values),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '更新失败')
        return
      }
      message.success('更新成功')
      closeForceRef.current = true
      closeModal()
      queryClient.invalidateQueries({ queryKey: ['quotaPackages'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteQuotaPackage,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['quotaPackages'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const batchEnable = useMutation({
    mutationFn: (ids: number[]) => batchUpdateQuotaPackageStatus(ids, 1),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '操作失败')
        return
      }
      message.success('批量启用成功')
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['quotaPackages'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const batchDisable = useMutation({
    mutationFn: (ids: number[]) => batchUpdateQuotaPackageStatus(ids, 0),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '操作失败')
        return
      }
      message.success('批量禁用成功')
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['quotaPackages'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const batchDelete = useMutation({
    mutationFn: (ids: number[]) => batchDeleteQuotaPackage(ids),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('批量删除成功')
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['quotaPackages'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

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

  const handleSubmit = (values: QuotaPackageForm & { status?: number }) => {
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleEdit = (record: QuotaPackage) => {
    closeForceRef.current = false
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      quota_value: record.quota_value,
      price_cents: record.price_cents,
      currency: record.currency,
      sort_order: record.sort_order,
      status: record.status,
    })
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const statusToggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) =>
      updateQuotaPackage(id, { status } as QuotaPackageForm & { status?: number }),
    onSuccess: (res, variables) => {
      if (res.code !== 0) {
        message.error(res.message || '操作失败')
        return
      }
      message.success(`已${variables.status === 1 ? '启用' : '禁用'}`)
      queryClient.invalidateQueries({ queryKey: ['quotaPackages'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
    onSettled: () => {
      setTogglingId(null)
    },
  })

  const handleStatusToggle = (record: QuotaPackage) => {
    const newStatus = record.status === 1 ? 0 : 1
    setTogglingId(record.id)
    statusToggleMutation.mutate({ id: record.id, status: newStatus })
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    { title: '额度', dataIndex: 'quota_value', render: (v: number) => formatNumber(v) },
    { title: '价格', dataIndex: 'price_cents', render: (v: number) => formatPrice(v) },
    { title: '货币', dataIndex: 'currency' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: number, record: QuotaPackage) => (
        <Space size="small">
          <Tag color={status === 1 ? 'green' : 'red'}>{STATUS_MAP[status] ?? status}</Tag>
          <Popconfirm
            title={`确定要${status === 1 ? '禁用' : '启用'}该额度包吗？`}
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
      render: (_: unknown, record: QuotaPackage) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除额度包 "${record.name}" 吗？`}
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

  const modalTitle = editingId !== null ? '编辑额度包' : '新增额度包'
  const submitLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Input.Search
          placeholder="搜索额度包"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onSearch={() => { setPage(1) }}
          style={{ width: 200 }}
          allowClear
        />
        <Button type="primary" onClick={() => {
          closeForceRef.current = false
          setEditingId(null)
          form.resetFields()
          form.setFieldsValue(defaultFormValues)
          setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
          setIsModalOpen(true)
        }}>
          新增额度包
        </Button>
      </div>

      {selectedRowKeys.length > 0 && (
        <Space style={{ marginBottom: 16 }}>
          <Popconfirm title="确定要批量启用选中的套餐吗？" onConfirm={() => batchEnable.mutate(selectedRowKeys as number[])}>
            <Button>批量启用</Button>
          </Popconfirm>
          <Popconfirm title="确定要批量禁用选中的套餐吗？" onConfirm={() => batchDisable.mutate(selectedRowKeys as number[])}>
            <Button>批量禁用</Button>
          </Popconfirm>
          <Popconfirm title="确认删除？" onConfirm={() => batchDelete.mutate(selectedRowKeys as number[])}>
            <Button danger>批量删除</Button>
          </Popconfirm>
        </Space>
      )}

      <Table
        size="middle"
        loading={isLoading}
        dataSource={data?.data?.data || []}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <EmptyState description="暂无额度包" actionText="新增额度包" onAction={() => setIsModalOpen(true)} /> }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.data?.pagination?.total || 0,
          onChange: setPage,
          showTotal: (total: number) => `共 ${total} 条`,
        }}
        columns={columns}
      />

      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={async () => { try { await form.submit() } catch { /* validation failed, Ant Design shows inline errors */ } }}
        confirmLoading={submitLoading}
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={defaultFormValues}
        >
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：1000 额度包" />
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
            <Form.Item label="货币" name="currency" rules={[{ required: true, message: '请输入货币' }]}>
              <Input placeholder="CNY" maxLength={8} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item label="排序" name="sort_order">
              <InputNumber style={{ width: 160 }} />
            </Form.Item>
          </Space>

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
