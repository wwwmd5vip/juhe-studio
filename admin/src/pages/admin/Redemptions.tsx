import { useState, useRef } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, App, Tag, Alert } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listRedemptions,
  generateRedemptions,
  deleteRedemption,
  type Redemption,
  type RedemptionForm,
} from '../../api/redemption'
import { useFinanceContext } from '../../contexts/FinanceContext'
import ConfirmPasswordModal from '../../components/ConfirmPasswordModal'

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '未使用', color: 'green' },
  1: { label: '已使用', color: 'blue' },
}

const STATUS_OPTIONS = [
  { value: undefined, label: '全部' },
  { value: 0, label: '未使用' },
  { value: 1, label: '已使用' },
]

function exportCSV(codes: { code: string; quota_value: number; expires_at?: string }[]) {
  const header = ['code', 'quota_value', 'quota_yuan', 'expires_at'].join(',')
  const rows = codes.map(c => [
    c.code,
    c.quota_value,
    (c.quota_value / 100).toFixed(2),
    c.expires_at || ''
  ].join(','))
  const csv = '\uFEFF' + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `兑换码_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const defaultFormValues: RedemptionForm = {
  count: 10,
  quota_value: 0,
  prefix: '',
}

export default function Redemptions() {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const { openFinanceDrawer } = useFinanceContext()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<number | undefined>(undefined)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm<RedemptionForm>()
  const initialValuesRef = useRef('')
  const closeForceRef = useRef(false)
  const [generatedCodes, setGeneratedCodes] = useState<Redemption[] | null>(null)

  // Confirm password modal
  const [confirmOpen, setConfirmOpen] = useState(false)
  const confirmActionRef = useRef<(() => void) | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['redemptions', page, status],
    queryFn: () => listRedemptions(page, 20, status),
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

  const generateMutation = useMutation({
    mutationFn: generateRedemptions,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '生成失败')
        return
      }
      message.success(`成功生成 ${res.data?.length || 0} 个兑换码`)
      closeForceRef.current = true
      setIsModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['redemptions'] })
      if (res.data) {
        setGeneratedCodes(res.data)
      }
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRedemption,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['redemptions'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const handleSubmit = (values: RedemptionForm) => {
    const payload: RedemptionForm = {
      count: values.count,
      quota_value: values.quota_value,
      prefix: values.prefix,
    }
    if (values.expires_at) {
      payload.expires_at = values.expires_at
    }
    generateMutation.mutate(payload)
  }

  const handleCopyCodes = async () => {
    if (!generatedCodes) return
    const text = generatedCodes.map((item) => item.code).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制到剪贴板')
    } catch {
      message.info('请手动复制')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '兑换码', dataIndex: 'code' },
    {
      title: '额度',
      dataIndex: 'quota_value',
      render: (v: number) => (v / 100).toFixed(2) + '元',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: number) => {
        const item = STATUS_MAP[value]
        if (!item) return <Tag>{value}</Tag>
        return <Tag color={item.color}>{item.label}</Tag>
      },
    },
    {
      title: '使用者',
      dataIndex: 'used_by',
      render: (value?: number) => value ? (
        <a onClick={() => openFinanceDrawer(value)} style={{ cursor: 'pointer' }}>{value}</a>
      ) : '-',
    },
    {
      title: '使用时间',
      dataIndex: 'used_at',
      render: (value?: string) => value || '-',
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
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
      render: (_: unknown, record: Redemption) => (
        <Space size="middle">
          {record.status === 0 && (
            <Button
              type="link"
              danger
              size="small"
              loading={deleteMutation.isPending && deleteMutation.variables === record.id}
              onClick={() => {
                confirmActionRef.current = () => deleteMutation.mutate(record.id)
                setConfirmOpen(true)
              }}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Select
            placeholder="状态"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            style={{ width: 120 }}
            allowClear
          />
          <Button
            onClick={() => {
              if (data?.data?.data) {
                const codes = data.data.data.map((r: Redemption) => ({
                  code: r.code,
                  quota_value: r.quota_value,
                  expires_at: r.expires_at || '',
                }))
                exportCSV(codes)
              }
            }}
          >
            导出当前页 CSV
          </Button>
        </Space>
        <Button type="primary" onClick={() => {
          closeForceRef.current = false
          form.resetFields()
          form.setFieldsValue(defaultFormValues)
          setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
          setIsModalOpen(true)
        }}>
          生成兑换码
        </Button>
      </div>

      <Table
        size="middle"
        loading={isLoading}
        dataSource={data?.data?.data || []}
        rowKey="id"
        scroll={{ x: 'max-content' }}
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
        title="生成兑换码"
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
        confirmLoading={generateMutation.isPending}
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={defaultFormValues}>
          <Form.Item
            label="数量"
            name="count"
            rules={[{ required: true, message: '请输入生成数量' }]}
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="额度"
            name="quota_value"
            rules={[
              { required: true, message: '请输入额度' },
              { type: 'number', min: 1, message: '额度必须大于 0' },
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="前缀" name="prefix">
            <Input placeholder="可选前缀" maxLength={16} />
          </Form.Item>

          <Form.Item
            label="过期时间"
            name="expires_at"
            rules={[
              { required: true, message: '请选择过期时间' },
              () => ({
                validator(_, value) {
                  if (value && new Date(value) <= new Date()) {
                    return Promise.reject(new Error('过期时间必须在未来'))
                  }
                  return Promise.resolve()
                },
              }),
            ]}
          >
            <Input type="datetime-local" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="兑换码已生成"
        open={generatedCodes !== null}
        onCancel={() => setGeneratedCodes(null)}
        onOk={() => setGeneratedCodes(null)}
        footer={[
          <Button key="copy" type="primary" onClick={handleCopyCodes}>
            复制全部
          </Button>,
          <Button key="export" onClick={() => exportCSV(generatedCodes || [])}>
            导出 CSV
          </Button>,
          <Button key="close" onClick={() => setGeneratedCodes(null)}>
            关闭
          </Button>,
        ]}
      >
        <Input.TextArea
          value={generatedCodes?.map((item) => item.code).join('\n') || ''}
          rows={6}
          readOnly
        />
      </Modal>

      {/* Confirm Password Modal */}
      <ConfirmPasswordModal
        open={confirmOpen}
        title="确认删除兑换码"
        description="确定删除该兑换码吗？此操作不可撤销。"
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
