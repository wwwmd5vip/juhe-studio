import { useState, useRef } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Space, App, Popconfirm, Tag, Alert } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  listTopUps,
  createTopUp,
  markTopUpPaid,
  markTopUpFailed,
  refundTopUp,
  batchUpdateTopUpStatus,
  type TopUp,
  type TopUpForm,
} from '../../api/topup'
import { useFinanceContext } from '../../contexts/FinanceContext'
import EmptyState from '../../components/EmptyState'
import ConfirmPasswordModal from '../../components/ConfirmPasswordModal'

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '待支付', color: '#fa8c16' },
  1: { label: '已支付', color: '#52c41a' },
  2: { label: '失败', color: '#ff4d4f' },
  3: { label: '已退款', color: '#1890ff' },
}

const formatNumber = (v: number) =>
  v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toLocaleString()

const formatPrice = (v: number) => (v / 100).toFixed(2) + '元'

function exportCSV(rows: Record<string, any>[]) {
  if (rows.length === 0) return
  const header = Object.keys(rows[0]).join(',')
  const body = rows
    .map((r) =>
      Object.values(r)
        .map((v) => (typeof v === 'string' ? `"${v}"` : (v ?? '')))
        .join(','),
    )
    .join('\n')
  const csv = '\uFEFF' + header + '\n' + body
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `充值订单_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const defaultFormValues: TopUpForm = {
  user_id: 0,
  quota_granted: 0,
}

export default function TopUps() {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const { openFinanceDrawer } = useFinanceContext()
  const [page, setPage] = useState(1)
  const [userId, setUserId] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [paidModalOpen, setPaidModalOpen] = useState(false)
  const [paidTopUpId, setPaidTopUpId] = useState<number | null>(null)
  const [paidTransactionId, setPaidTransactionId] = useState('')
  const [form] = Form.useForm<TopUpForm>()
  const initialValuesRef = useRef('')
  const closeForceRef = useRef(false)
  const [filterStatus, setFilterStatus] = useState<number>()
  const [filterDateRange, setFilterDateRange] = useState<[string, string] | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // Confirm password modal
  const [confirmOpen, setConfirmOpen] = useState(false)
  const confirmActionRef = useRef<(() => void) | null>(null)

  const parsedUserId = userId ? Number(userId) : undefined

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['topups', page, parsedUserId, filterStatus, filterDateRange],
    queryFn: () =>
      listTopUps(
        page,
        20,
        parsedUserId,
        filterStatus,
        filterDateRange?.[0],
        filterDateRange?.[1],
      ),
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
    mutationFn: createTopUp,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '创建失败')
        return
      }
      message.success('手动充值成功')
      closeForceRef.current = true
      setIsModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['topups'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const paidMutation = useMutation({
    mutationFn: ({ id, transactionId }: { id: number; transactionId: string }) =>
      markTopUpPaid(id, transactionId),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '操作失败')
        return
      }
      message.success('已标记为支付')
      setPaidModalOpen(false)
      setPaidTopUpId(null)
      setPaidTransactionId('')
      queryClient.invalidateQueries({ queryKey: ['topups'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const failedMutation = useMutation({
    mutationFn: markTopUpFailed,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '操作失败')
        return
      }
      message.success('已标记为失败')
      queryClient.invalidateQueries({ queryKey: ['topups'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const refundMutation = useMutation({
    mutationFn: refundTopUp,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '退款失败')
        return
      }
      message.success('已退款')
      queryClient.invalidateQueries({ queryKey: ['topups'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const batchMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: string }) =>
      batchUpdateTopUpStatus(ids, status),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '批量操作失败')
        return
      }
      message.success(`已批量更新 ${res.data?.affected ?? 0} 条`)
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['topups'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const handleSubmit = (values: TopUpForm) => {
    createMutation.mutate(values)
  }

  const handleOpenPaidModal = (record: TopUp) => {
    setPaidTopUpId(record.id)
    setPaidTransactionId(record.transaction_id || '')
    setPaidModalOpen(true)
  }

  const handleConfirmPaid = () => {
    if (paidTopUpId === null) return
    paidMutation.mutate({ id: paidTopUpId, transactionId: paidTransactionId })
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户ID', dataIndex: 'user_id', render: (id: number) => (
      <a onClick={() => openFinanceDrawer(id)} style={{ cursor: 'pointer' }}>{id}</a>
    ) },
    {
      title: '金额(元)',
      dataIndex: 'amount_cents',
      render: (v: number) => formatPrice(v),
    },
    {
      title: '额度',
      dataIndex: 'quota_granted',
      render: (v: number) => formatNumber(v),
    },
    { title: '货币', dataIndex: 'currency' },
    { title: '支付方式', dataIndex: 'payment_method' },
    {
      title: '状态',
      dataIndex: 'payment_status',
      render: (status: number) => {
        const info = STATUS_MAP[status]
        if (!info) return status
        return <Tag color={info.color}>{info.label}</Tag>
      },
    },
    {
      title: '交易号',
      dataIndex: 'transaction_id',
      render: (value?: string) => value || '-',
    },
    {
      title: '支付时间',
      dataIndex: 'paid_at',
      render: (value?: string) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (value: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: TopUp) => (
        <Space size="middle">
          {record.payment_status === 0 && (
            <>
              <Button type="link" size="small" onClick={() => handleOpenPaidModal(record)}>
                标记支付
              </Button>
              <Popconfirm
                title="确认失败"
                description={`确定将订单 #${record.id} 标记为失败吗？`}
                onConfirm={() => failedMutation.mutate(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger size="small">
                  标记失败
                </Button>
              </Popconfirm>
            </>
          )}
          {record.payment_status === 1 && (
            <Button
              type="link"
              danger
              size="small"
              onClick={() => {
                confirmActionRef.current = () => refundMutation.mutate(record.id)
                setConfirmOpen(true)
              }}
            >
              退款
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索用户ID"
            onSearch={(value) => { setUserId(value); setPage(1); }}
            allowClear
            style={{ width: 200 }}
          />
          <Select
            placeholder="支付状态"
            allowClear
            style={{ width: 120 }}
            value={filterStatus}
            onChange={(v) => {
              setFilterStatus(v)
              setPage(1)
            }}
            options={Object.entries(STATUS_MAP).map(([k, v]) => ({
              label: v.label,
              value: Number(k),
            }))}
          />
          <DatePicker.RangePicker
            value={
              filterDateRange
                ? [dayjs(filterDateRange[0]), dayjs(filterDateRange[1])]
                : null
            }
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setFilterDateRange([
                  dates[0].format('YYYY-MM-DD'),
                  dates[1].format('YYYY-MM-DD'),
                ])
              } else {
                setFilterDateRange(null)
              }
              setPage(1)
            }}
          />
          <Button onClick={() => exportCSV(data?.data?.data || [])}>导出CSV</Button>
        </Space>
        <Button type="primary" onClick={() => {
          closeForceRef.current = false
          form.resetFields()
          form.setFieldsValue(defaultFormValues)
          setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
          setIsModalOpen(true)
        }}>
          手动充值
        </Button>
      </div>

      {selectedRowKeys.length > 0 && (
        <Space style={{ marginBottom: 16 }}>
          <Popconfirm
            title={`确定要批量标记 ${selectedRowKeys.length} 条为已支付吗？`}
            onConfirm={() =>
              batchMutation.mutate({
                ids: selectedRowKeys as number[],
                status: 'paid',
              })
            }
            okText="确定"
            cancelText="取消"
          >
            <Button type="primary" loading={batchMutation.isPending}>
              标记已支付 ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
          <Popconfirm
            title={`确定要批量标记 ${selectedRowKeys.length} 条为失败吗？`}
            onConfirm={() =>
              batchMutation.mutate({
                ids: selectedRowKeys as number[],
                status: 'failed',
              })
            }
            okText="确定"
            cancelText="取消"
          >
            <Button danger loading={batchMutation.isPending}>
              标记失败 ({selectedRowKeys.length})
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
        locale={{ emptyText: <EmptyState description="暂无充值订单" /> }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
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
        title="手动充值"
        open={isModalOpen}
        onCancel={() => {
          if (closeForceRef.current) {
            closeForceRef.current = false
            setIsModalOpen(false)
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
              },
            })
          } else {
            form.resetFields()
            setIsModalOpen(false)
          }
        }}
        onOk={async () => { try { await form.submit() } catch { /* validation failed, Ant Design shows inline errors */ } }}
        confirmLoading={createMutation.isPending}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={defaultFormValues}>
          <Form.Item
            label="用户ID"
            name="user_id"
            rules={[{ required: true, message: '请输入用户ID' }]}
          >
            <InputNumber min={1} max={999999} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="充值额度"
            name="quota_granted"
            rules={[{ required: true, message: '请输入充值额度' }]}
          >
            <InputNumber min={1} max={99999999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="标记为已支付"
        open={paidModalOpen}
        onCancel={() => {
          setPaidModalOpen(false)
          setPaidTopUpId(null)
          setPaidTransactionId('')
        }}
        onOk={handleConfirmPaid}
        confirmLoading={paidMutation.isPending}
        width={480}
      >
        <Form layout="vertical">
          <Form.Item label="交易号（可选）">
            <Input
              placeholder="第三方支付交易号"
              value={paidTransactionId}
              onChange={(e) => setPaidTransactionId(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Confirm Password Modal */}
      <ConfirmPasswordModal
        open={confirmOpen}
        title="确认退款"
        description="确定退款该订单吗？此操作不可撤销。"
        onConfirm={() => {
          confirmActionRef.current?.()
          confirmActionRef.current = null
          setConfirmOpen(false)
        }}
        onCancel={() => {
          confirmActionRef.current = null
          setConfirmOpen(false)
        }}
      />
    </div>
  )
}
