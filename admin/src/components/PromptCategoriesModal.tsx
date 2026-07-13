import { useState } from 'react'
import { Modal, Table, Button, Form, Input, InputNumber, Space, App, Popconfirm } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listPromptCategories,
  createPromptCategory,
  updatePromptCategory,
  deletePromptCategory,
  type PromptCategory,
  type PromptCategoryForm,
} from '../api/prompt'

interface Props {
  type: string
  open: boolean
  onClose: () => void
}

const defaultFormValues: PromptCategoryForm = {
  name: '',
  description: '',
  sort_order: 0,
}

export default function PromptCategoriesModal({ type, open, onClose }: Props) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm<PromptCategoryForm>()

  const { data, isLoading } = useQuery({
    queryKey: ['promptCategories', type, page],
    queryFn: () => listPromptCategories(type, page, 10),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: (values: PromptCategoryForm) => createPromptCategory(type, values),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '创建失败')
        return
      }
      message.success('创建成功')
      form.resetFields()
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['promptCategories', type] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: PromptCategoryForm }) =>
      updatePromptCategory(id, values),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '更新失败')
        return
      }
      message.success('更新成功')
      form.resetFields()
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['promptCategories', type] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePromptCategory,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['promptCategories', type] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const handleSubmit = (values: PromptCategoryForm) => {
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleEdit = (record: PromptCategory) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      sort_order: record.sort_order,
    })
  }

  const handleClose = () => {
    setEditingId(null)
    form.resetFields()
    setPage(1)
    onClose()
  }

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: '名称', dataIndex: 'name' },
    {
      title: '描述',
      dataIndex: 'description',
      render: (value?: string) => value || '-',
    },
    { title: '排序', dataIndex: 'sort_order' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: PromptCategory) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除分类 "${record.name}" 吗？`}
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

  return (
    <Modal
      title="分类管理"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={720}
    >
      <div style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="inline"
          onFinish={handleSubmit}
          initialValues={defaultFormValues}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="分类名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="描述" />
          </Form.Item>
          <Form.Item label="排序" name="sort_order">
            <InputNumber />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              onClick={async () => { try { await form.submit() } catch { /* validation failed */ } }}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingId !== null ? '更新' : '新增'}
            </Button>
            {editingId !== null && (
              <Button style={{ marginLeft: 8 }} onClick={() => { setEditingId(null); form.resetFields() }}>
                取消
              </Button>
            )}
          </Form.Item>
        </Form>
      </div>

      <Table
        loading={isLoading}
        dataSource={data?.data?.data || []}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.data?.pagination?.total || 0,
          onChange: setPage,
        }}
        columns={columns}
      />
    </Modal>
  )
}
