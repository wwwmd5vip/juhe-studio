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
  Alert,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listTokens,
  createToken,
  updateToken,
  deleteToken,
  batchDeleteTokens,
  type Token,
  type TokenForm,
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

export default function AdminTokens() {
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

  // Reveal key state — reserved, endpoint not yet implemented on server
  // const [revealId, setRevealId] = useState<number | null>(null)
  // const [revealPassword, setRevealPassword] = useState('')
  // const [revealedKey, setRevealedKey] = useState<string | null>(null)

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

  // Admin: fetch ALL tokens with ?all=true
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-tokens', page, keyword],
    queryFn: () => listTokens(page, 20, keyword, true),
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
    mutationFn: (values: FormValues) => {
      const payload: TokenForm = {
        name: values.name,
        remain_quota: values.remain_quota,
        unlimited_quota: values.unlimited_quota,
        group: values.group,
        model_limits: values.model_limits,
      }
      return createToken(payload)
    },
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '创建失败'); return }
      message.success('创建成功')
      setIsModalOpen(false)
      setEditingId(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] })
      if (res.data?.key) setCreatedKey(res.data.key)
    },
    onError: (error: Error) => message.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: FormValues }) =>
      updateToken(id, {
        name: values.name,
        remain_quota: values.remain_quota,
        unlimited_quota: values.unlimited_quota,
        group: values.group,
        model_limits: values.model_limits,
        status: values.status,
      }),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '更新失败'); return }
      message.success('更新成功')
      setIsModalOpen(false)
      setEditingId(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) =>
      updateToken(id, { status }),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '状态切换失败'); return }
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteToken,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '删除失败'); return }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteTokens,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '批量删除失败'); return }
      message.success('批量删除成功')
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  // Reserved: endpoint not yet implemented on server
  // const handleRevealKey = async () => {
  //   if (!revealPassword || !revealId) return
  //   try {
  //     const res = await revealTokenKey(revealId, revealPassword)
  //     if (res.code !== 0) {
  //       message.error(res.message || '验证失败')
  //       setRevealPassword('')
  //       return
  //     }
  //     setRevealedKey(res.data?.key ?? null)
  //     setRevealPassword('')
  //   } catch (e: any) {
  //     message.error(e?.message || '请求失败')
  //     setRevealPassword('')
  //   }
  // }

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

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '用户',
      dataIndex: 'user_id',
      width: 80,
      render: (value: number) => value || '-',
    },
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
          <Popconfirm
            title={`确定要${status === 1 ? '禁用' : '启用'}该 Token 吗？`}
            onConfirm={() => toggleStatusMutation.mutate({ id: record.id, status: status === 1 ? 0 : 1 })}
          >
            <Switch
              checked={status === 1}
              loading={toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === record.id}
            />
          </Popconfirm>
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
    { title: '无限额度', dataIndex: 'unlimited_quota', render: (v: boolean) => v ? <Tag color="green">无限</Tag> : '否' },
    { title: '分组', dataIndex: 'group' },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Token) => (
        <Space size="middle">
          {/* Reserved: "查看 Key" — endpoint not yet implemented on server */}
          {/*
          <Button type="link" size="small" onClick={() => { setRevealId(record.id); setRevealedKey(null) }}>
            查看 Key
          </Button>
          */}
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
            <Button type="link" danger size="small"
              loading={deleteMutation.isPending && deleteMutation.variables === record.id}>
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

      <CsvImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="批量导入 Token"
        templateColumns={['name', 'user_id', 'remain_quota', 'group', 'model_limits']}
        templateUrl="/api/import/tokens"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin-tokens'] })}
      />

      {/* Reserved: "查看完整 API Key" modal — endpoint not yet implemented on server */}
      {/* <Modal
        title="查看完整 API Key"
        open={revealId !== null}
        onCancel={() => { setRevealId(null); setRevealedKey(null); setRevealPassword('') }}
        footer={null}
        width={420}
      >
        {revealedKey ? (
          <div>
            <p style={{ color: '#666', marginBottom: 8 }}>完整 Key：</p>
            <Input.TextArea value={revealedKey} rows={3} readOnly style={{ fontFamily: 'monospace' }} />
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: 12 }}>请输入管理员密码以查看完整 Key：</p>
            <Space.Compact style={{ width: '100%' }}>
              <Input.Password
                value={revealPassword}
                onChange={(e) => setRevealPassword(e.target.value)}
                onPressEnter={handleRevealKey}
                placeholder="管理员密码"
              />
              <Button type="primary" onClick={handleRevealKey}>确认</Button>
            </Space.Compact>
          </div>
        )}
      </Modal> */}
    </div>
  )
}
