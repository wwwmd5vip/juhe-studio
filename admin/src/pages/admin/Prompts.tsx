import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  App,
  Popconfirm,
  Alert,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useThemeStore } from '../../stores/themeStore'
import {
  listPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  publishPrompt,
  listPromptCategories,
  type Prompt,
  type PromptForm,
  type PromptCategory,
} from '../../api/prompt'
import PromptCategoriesModal from '../../components/PromptCategoriesModal'
import PromptVersionsModal from '../../components/PromptVersionsModal'
import PromptPackageItemsModal from '../../components/PromptPackageItemsModal'
import EmptyState from '../../components/EmptyState'

type PromptType = 'image' | 'agent' | 'package'

const PROMPT_TABS = [
  { key: 'image', label: '图片提示词' },
  { key: 'agent', label: '智能体提示词' },
  { key: 'package', label: '封装功能' },
]

const STATUS_OPTIONS = [
  { value: 0, label: '草稿' },
  { value: 1, label: '已发布' },
  { value: 2, label: '已归档' },
]

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '草稿', color: 'default' },
  1: { label: '已发布', color: '#52c41a' },
  2: { label: '已归档', color: '#fa8c16' },
}

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  image: { label: '图片', color: 'blue' },
  agent: { label: '智能体', color: 'purple' },
  package: { label: '封装', color: 'green' },
}

type FormValues = Omit<PromptForm, 'variables' | 'tags'> & {
  variables: { key: string; value: string }[]
  tags: string
}

const defaultFormValues: FormValues = {
  category_id: 0,
  title: '',
  content: '',
  status: 0,
  variables: [],
  tags: '',
}

function transformFormValues(values: FormValues): PromptForm {
  const variables: Record<string, string> = {}
  for (const v of values.variables) {
    const k = v.key.trim()
    if (k) variables[k] = v.value
  }

  const tags = values.tags
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return {
    category_id: values.category_id,
    title: values.title,
    content: values.content,
    status: values.status,
    variables,
    tags,
  }
}

export default function Prompts() {
  const isDark = useThemeStore((s) => s.theme) === 'dark'
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [type, setType] = useState<PromptType>('image')
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [versionPromptId, setVersionPromptId] = useState<number | null>(null)
  const [packagePromptId, setPackagePromptId] = useState<number | null>(null)
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

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['prompts', type, page, keyword],
    queryFn: () => listPrompts(type, page, 20, keyword),
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

  const { data: categoriesData } = useQuery({
    queryKey: ['promptCategories', type],
    queryFn: () => listPromptCategories(type, 1, 100),
  })
  const categories: PromptCategory[] = categoriesData?.data?.data || []

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => createPrompt(type, transformFormValues(values)),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '创建失败')
        return
      }
      message.success('创建成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: FormValues }) =>
      updatePrompt(id, transformFormValues(values)),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '更新失败')
        return
      }
      message.success('更新成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePrompt,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const handleBatchDelete = async () => {
    setBatchDeleting(true)
    try {
      const keys = [...selectedRowKeys]
      const results = await Promise.allSettled(
        keys.map(async (key) => {
          const res = await deletePrompt(Number(key))
          if (res.code !== 0) throw new Error(res.message)
        })
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed === 0) {
        message.success(`成功删除 ${keys.length} 个提示词`)
      } else {
        message.warning(`删除完成：${keys.length - failed} 成功，${failed} 失败`)
      }
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    } finally {
      setBatchDeleting(false)
    }
  }

  const publishMutation = useMutation({
    mutationFn: publishPrompt,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '发布失败')
        return
      }
      message.success('发布成功')
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
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
    form.setFieldsValue({
      ...defaultFormValues,
      category_id: categories.length > 0 ? categories[0].id : 0,
    })
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleEdit = (record: Prompt) => {
    setEditingId(record.id)
    const varEntries = Object.entries(record.variables || {}).map(([key, value]) => ({ key, value }))
    form.setFieldsValue({
      category_id: record.category_id,
      title: record.title,
      content: record.content,
      status: record.status,
      variables: varEntries,
      tags: (record.tags || []).join('\n'),
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

  const handleTabChange = (key: string) => {
    setType(key as PromptType)
    setPage(1)
    setKeyword('')
  }

  const handleSearch = (v: string) => {
    setKeyword(v)
    setPage(1)
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '类型',
      dataIndex: 'type',
      render: (t: string) => {
        const info = TYPE_MAP[t]
        return info ? <Tag color={info.color}>{info.label}</Tag> : t
      },
    },
    { title: '分类 ID', dataIndex: 'category_id' },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
      render: (content: string) => content || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: number) => {
        const info = STATUS_MAP[status]
        return info ? <Tag color={info.color}>{info.label}</Tag> : status
      },
    },
    {
      title: '变量',
      dataIndex: 'variables',
      render: (variables: Record<string, string>) => {
        const str = JSON.stringify(variables || {})
        const display = str.length > 50 ? str.slice(0, 50) + '...' : str
        return <Typography.Text>{display}</Typography.Text>
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags: string[]) =>
        (tags || []).map((tag) => (
          <Tag key={tag} style={{ marginBottom: 4 }}>
            {tag}
          </Tag>
        )),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Prompt) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            loading={publishMutation.isPending && publishMutation.variables === record.id}
            onClick={() => publishMutation.mutate(record.id)}
          >
            发布
          </Button>
          <Button type="link" size="small" onClick={() => setVersionPromptId(record.id)}>
            版本
          </Button>
          {type === 'package' && (
            <Button type="link" size="small" onClick={() => setPackagePromptId(record.id)}>
              封装项
            </Button>
          )}
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除提示词 "${record.title}" 吗？`}
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
    <div>
      <Tabs activeKey={type} items={PROMPT_TABS} onChange={handleTabChange} />

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索标题/内容"
          onSearch={handleSearch}
          style={{ width: 300 }}
          allowClear
        />
        <Space>
          <Button onClick={() => setCategoryModalOpen(true)}>分类管理</Button>
          <Button type="primary" onClick={handleOpenModal}>
            新增
          </Button>
        </Space>
      </div>

      {!isLoading && (data?.data?.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="暂无提示词"
          description="创建您的第一个提示词模板，开始构建AI应用"
          actionText="创建提示词"
          onAction={handleOpenModal}
        />
      ) : (
        <>
          {selectedRowKeys.length > 0 && (
            <Space style={{ marginBottom: 16 }}>
              <span>已选 {selectedRowKeys.length} 项</span>
              <Popconfirm
                title="确认批量删除"
                description={`确定删除选中的 ${selectedRowKeys.length} 个提示词吗？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button danger loading={batchDeleting}>批量删除</Button>
              </Popconfirm>
            </Space>
          )}

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
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            expandable={{
              expandedRowRender: (record: Prompt) => (
                <div style={{ padding: '8px 0' }}>
                  <Typography.Paragraph
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0,
                      padding: 12,
                      background: isDark ? '#1f1f1f' : '#fafafa',
                      borderRadius: 6,
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    {record.content || '(无内容)'}
                  </Typography.Paragraph>
                  {(record.variables && Object.keys(record.variables).length > 0) && (
                    <div style={{ marginTop: 8 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        变量：{Object.entries(record.variables).map(([k, v]) => `${k}: ${v}`).join('，')}
                      </Typography.Text>
                    </div>
                  )}
                  {(record.tags && record.tags.length > 0) && (
                    <div style={{ marginTop: 4 }}>
                      <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>标签：</Typography.Text>
                        {record.tags.map((tag) => (
                          <Tag key={tag} style={{ fontSize: 11 }}>{tag}</Tag>
                        ))}
                      </Space>
                    </div>
                  )}
                  <div style={{ marginTop: 4 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      分类 ID：{record.category_id}
                    </Typography.Text>
                  </div>
                </div>
              ),
            }}
          />
        </>
      )}

      <PromptCategoriesModal
        type={type}
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
      />

      <PromptVersionsModal
        promptId={versionPromptId}
        open={versionPromptId !== null}
        onClose={() => setVersionPromptId(null)}
      />

      <PromptPackageItemsModal
        promptId={packagePromptId}
        open={packagePromptId !== null}
        onClose={() => setPackagePromptId(null)}
      />

      <Modal
        title={editingId !== null ? '编辑提示词' : '新增提示词'}
        open={isModalOpen}
        onCancel={handleCloseModal}
        onOk={async () => {
          try { await form.submit() } catch { /* validation failed, Ant Design shows inline errors */ }
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={defaultFormValues}>
          <Form.Item
            label="分类"
            name="category_id"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select
              placeholder="选择分类"
              options={categories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </Form.Item>

          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="提示词标题" />
          </Form.Item>

          <Form.Item label="内容" name="content" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} placeholder="提示词内容" maxLength={50000} />
          </Form.Item>

          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={STATUS_OPTIONS} placeholder="选择状态" />
          </Form.Item>

          <Form.Item label="变量">
            <Form.List name="variables">
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="start">
                      <Form.Item {...rest} name={[name, 'key']} rules={[{ required: true, message: '变量名' }]} noStyle>
                        <Input placeholder="变量名" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'value']} rules={[{ required: true, message: '类型/描述' }]} noStyle>
                        <Input placeholder="类型" style={{ width: 120 }} />
                      </Form.Item>
                      <Button type="text" danger onClick={() => remove(name)} size="small">
                        删除
                      </Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ key: '', value: 'string' })} block size="small">
                    + 添加变量
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item label="标签" name="tags">
            <Input.TextArea rows={3} placeholder="每行一个标签" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
