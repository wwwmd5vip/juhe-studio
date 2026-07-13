import { useState, useRef } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  App,
  Popconfirm,
  Typography,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  type Vendor,
  type VendorForm,
} from '../../api/vendor'
import EmptyState from '../../components/EmptyState'

const defaultFormValues: VendorForm = {
  name: '',
  description: '',
  icon_url: '',
}

export default function Vendors() {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm<VendorForm>()
  const initialValuesRef = useRef('')
  const closeForceRef = useRef(false)

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', page, keyword],
    queryFn: () => listVendors(page, 20, keyword),
  })

  const createMutation = useMutation({
    mutationFn: createVendor,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '创建失败')
        return
      }
      message.success('创建成功')
      closeForceRef.current = true
      setIsModalOpen(false)
      setEditingId(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<VendorForm> }) =>
      updateVendor(id, values),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '更新失败')
        return
      }
      message.success('更新成功')
      closeForceRef.current = true
      setIsModalOpen(false)
      setEditingId(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteVendor,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const handleSubmit = (values: VendorForm) => {
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleOpenModal = () => {
    closeForceRef.current = false
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue(defaultFormValues)
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleEdit = (record: Vendor) => {
    closeForceRef.current = false
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      description: record.description ?? '',
      icon_url: record.icon_url ?? '',
    })
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
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

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '名称',
      dataIndex: 'name',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '图标 URL',
      dataIndex: 'icon_url',
      ellipsis: true,
      render: (url: string) =>
        url ? (
          <Typography.Link href={url} ellipsis style={{ maxWidth: 200 }}>
            {url}
          </Typography.Link>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Vendor) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除厂商 "${record.name}" 吗？`}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger size="small" loading={deleteMutation.isPending && deleteMutation.variables === record.id}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const modalTitle = editingId !== null ? '编辑厂商' : '新增厂商'
  const submitLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索厂商名称"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            if (!e.target.value) {
              setPage(1)
            }
          }}
          onSearch={(v) => {
            setKeyword(v)
            setPage(1)
          }}
          style={{ width: 300 }}
          allowClear
        />
        <Button type="primary" onClick={handleOpenModal}>
          新增厂商
        </Button>
      </div>

      {!isLoading && (data?.data?.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="暂无模型厂商"
          description="添加模型厂商以接入更多AI服务"
          actionText="添加厂商"
          onAction={handleOpenModal}
        />
      ) : (
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
      )}

      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={handleCloseModal}
        onOk={async () => { try { await form.submit() } catch { /* validation failed, Ant Design shows inline errors */ } }}
        confirmLoading={submitLoading}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={defaultFormValues}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入厂商名称' }]}
          >
            <Input placeholder="例如：OpenAI, Anthropic" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="厂商描述" />
          </Form.Item>

          <Form.Item
            label="图标 URL"
            name="icon_url"
            rules={[
              { type: 'url', message: '请输入有效的 URL' },
              { validator: (_, v) => !v || v.startsWith('http://') || v.startsWith('https://')
                ? Promise.resolve() : Promise.reject('仅支持 http/https 协议')
              },
            ]}
          >
            <Input placeholder="https://example.com/icon.png" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
