import { useState, useRef } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Space,
  App,
  Popconfirm,
  Tag,
  Typography,
} from 'antd'
import { PlusOutlined, SendOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listReleases,
  createRelease,
  updateRelease,
  deleteRelease,
  publishRelease,
  getPlatformLabel,
  PLATFORM_OPTIONS,
  type Release,
  type ReleaseForm,
} from '../../api/release'
import EmptyState from '../../components/EmptyState'

const { TextArea } = Input
const { Text } = Typography

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '草稿', color: 'default' },
  1: { label: '已发布', color: 'green' },
  2: { label: '已归档', color: 'orange' },
}

const defaultFormValues: ReleaseForm = {
  version: '',
  platform: 'darwin',
  download_url: '',
  file_size: 0,
  sha256: '',
  release_notes: '',
  min_app_version: '',
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '-'
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`
}

export default function Releases() {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm<ReleaseForm>()
  const initialValuesRef = useRef('')
  const closeForceRef = useRef(false)

  const { data, isLoading } = useQuery({
    queryKey: ['releases', page, keyword],
    queryFn: () => listReleases(page, 20, keyword),
  })

  const createMutation = useMutation({
    mutationFn: createRelease,
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
      queryClient.invalidateQueries({ queryKey: ['releases'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ReleaseForm> }) => updateRelease(id, data),
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
      queryClient.invalidateQueries({ queryKey: ['releases'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRelease,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['releases'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const publishMutation = useMutation({
    mutationFn: publishRelease,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '发布失败')
        return
      }
      message.success('发布成功')
      queryClient.invalidateQueries({ queryKey: ['releases'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const handleOpenCreate = () => {
    closeForceRef.current = false
    setEditingId(null)
    form.resetFields()
    form.setFieldsValue(defaultFormValues)
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (record: Release) => {
    closeForceRef.current = false
    setEditingId(record.id)
    form.setFieldsValue({
      version: record.version,
      platform: record.platform,
      download_url: record.download_url,
      file_size: record.file_size,
      sha256: record.sha256,
      release_notes: record.release_notes,
      min_app_version: record.min_app_version,
    })
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (editingId !== null) {
        updateMutation.mutate({ id: editingId, data: values })
      } else {
        createMutation.mutate(values)
      }
    })
  }

  const columns = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (v: string) => getPlatformLabel(v),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (v: number) => formatFileSize(v),
    },
    {
      title: '最低版本',
      dataIndex: 'min_app_version',
      key: 'min_app_version',
      width: 110,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: number) => {
        const s = STATUS_MAP[v] || { label: '未知', color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      key: 'published_at',
      width: 170,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: Release) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => handleOpenEdit(record)}>
            编辑
          </Button>
          {record.status === 0 && (
            <Popconfirm
              title="确认发布"
              description={`确定发布版本 ${record.version} 吗？`}
              onConfirm={() => publishMutation.mutate(record.id)}
              okText="发布"
              cancelText="取消"
            >
              <Button size="small" type="link" icon={<SendOutlined />}>
                发布
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="确认删除"
            description={`确定删除版本 "${record.version}" 吗？`}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button size="small" type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const modalTitle = editingId !== null ? '编辑版本' : '新增版本'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索版本号或平台"
          allowClear
          onSearch={(value) => { setKeyword(value); setPage(1) }}
          style={{ width: 300 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
          新增版本
        </Button>
      </div>

      <Table
        columns={columns}
        scroll={{ x: 'max-content' }}
        dataSource={data?.data?.data || []}
        rowKey="id"
        loading={isLoading}
        locale={{
          emptyText: (
            <EmptyState
              title="暂无版本记录"
              description="添加应用版本以管理客户端更新"
              actionText="添加版本"
              onAction={handleOpenCreate}
            />
          ),
        }}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.data?.pagination?.total || 0,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      <Modal
        title={modalTitle}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
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
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={defaultFormValues}>
          <Form.Item
            name="version"
            label="版本号"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="例如 0.2.0" />
          </Form.Item>
          <Form.Item
            name="platform"
            label="平台"
            rules={[{ required: true, message: '请选择平台' }]}
          >
            <Select options={PLATFORM_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="download_url"
            label="下载地址"
            rules={[
              { required: true, message: '请输入下载地址' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
          >
            <Input placeholder="https://releases.example.com/app-0.2.0.dmg" />
          </Form.Item>
          <Form.Item name="file_size" label="文件大小 (字节)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="可选" />
          </Form.Item>
          <Form.Item name="sha256" label="SHA256">
            <Input placeholder="可选，文件校验值" />
          </Form.Item>
          <Form.Item name="min_app_version" label="最低兼容版本">
            <Input placeholder="低于此版本的客户端将被要求强制更新" />
          </Form.Item>
          <Form.Item name="release_notes" label="更新日志">
            <TextArea rows={6} placeholder="支持 Markdown 格式的更新日志" maxLength={50000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
