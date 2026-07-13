import { useState, useEffect, useRef, useCallback } from 'react'
import { Table, Input, Button, Modal, Form, InputNumber, Select, Space, App, Tag, Switch, Popconfirm, Progress, Divider, Tabs } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  batchDeleteUsers,
  batchUpdateUserStatus,
  adjustUserQuota,
  setUserPassword,
  listGroups,
  type User,
  type UserCreateForm,
  type UserUpdateForm,
} from '../../api/user'
import { listSubscriptionPlans, listUserSubscriptions, subscribeUser, type SubscriptionPlan } from '../../api/subscription'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../../components/EmptyState'
import { UserFinanceTab } from '../../components/UserFinanceTab'
import CsvImportModal from '../../components/CsvImportModal'
import ConfirmPasswordModal from '../../components/ConfirmPasswordModal'

const ROLE_OPTIONS = [
  { value: 1, label: '普通用户' },
  { value: 10, label: '管理员' },
  { value: 100, label: '超级管理员' },
]

const STATUS_OPTIONS = [
  { value: 0, label: '禁用' },
  { value: 1, label: '启用' },
]

const ROLE_MAP: Record<number, string> = {
  1: '普通用户',
  10: '管理员',
  100: '超级管理员',
}

const ROLE_COLOR: Record<number, string> = {
  1: 'blue',
  10: 'purple',
  100: 'red',
}

const STATUS_MAP: Record<number, string> = {
  0: '禁用',
  1: '启用',
}

function formatNumber(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return v.toLocaleString()
}

function exportCSV(rows: Record<string, any>[]) {
  if (rows.length === 0) return
  const fields = ['id', 'username', 'email', 'role', 'status', 'quota_yuan', 'used_quota_yuan', 'created_at']
  const header = fields.join(',')
  const body = rows
    .map((r) =>
      fields
        .map((f) => {
          let v: any
          if (f === 'quota_yuan') v = ((r.quota ?? 0) / 100).toFixed(2)
          else if (f === 'used_quota_yuan') v = ((r.used_quota ?? 0) / 100).toFixed(2)
          else v = r[f]
          return typeof v === 'string' ? `"${v}"` : (v ?? '')
        })
        .join(','),
    )
    .join('\n')
  const csv = '\uFEFF' + header + '\n' + body
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `用户列表_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type FormValues = {
  username?: string
  email?: string
  password?: string
  role?: number
  status?: number
  group?: string
  quota?: number
  newPassword?: string
}

const defaultCreateValues: FormValues = {
  username: '',
  email: '',
  password: '',
  role: 1,
  group: '',
}

export default function Users() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [editTab, setEditTab] = useState('basic')
  const [form] = Form.useForm<FormValues>()

  // Dirty-form detection
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

  // Confirm password modal state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmDesc, setConfirmDesc] = useState('')
  const pendingActionRef = useRef<(() => void) | null>(null)

  const openConfirm = (title: string, desc: string, action: () => void) => {
    setConfirmTitle(title)
    setConfirmDesc(desc)
    pendingActionRef.current = action
    setConfirmOpen(true)
  }

  // Quota adjustment sub-modal
  const [quotaModalOpen, setQuotaModalOpen] = useState(false)
  const [quotaUserId, setQuotaUserId] = useState<number | null>(null)
  const [quotaForm] = Form.useForm<{ amount: number; description: string }>()

  // CSV import modal
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Groups for dropdown
  const [groupOptions, setGroupOptions] = useState<string[]>(['default', 'vip', 'enterprise', 'trial'])

  // Subscription plans
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [editingUserSubs, setEditingUserSubs] = useState<SubscriptionPlan[]>([])
  const isMountedRef = useRef(true)
  useEffect(() => { return () => { isMountedRef.current = false } }, [])

  useEffect(() => {
    listGroups().then(res => {
      if (!isMountedRef.current) return
      if (res.code === 0 && Array.isArray(res.data)) {
        setGroupOptions(prev => [...new Set([...res.data!, ...prev])])
      }
    }).catch(() => {})
    listSubscriptionPlans(1, 100).then(res => {
      if (!isMountedRef.current) return
      if (res.code === 0 && res.data?.data) {
        setPlans(res.data.data.filter(p => p.status === 1))
      }
    }).catch(() => {})
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, keyword],
    queryFn: () => listUsers(page, 20, keyword),
  })

  // load user's current subscriptions when editing
  useEffect(() => {
    if (editingId !== null && isModalOpen) {
      listUserSubscriptions(1, 20, editingId).then(res => {
        if (!isMountedRef.current) return
        if (res.code === 0 && res.data?.data) {
          const activeSubs = res.data.data.filter(s => s.status === 1)
          const planIds = activeSubs.map(s => s.plan_id)
          setEditingUserSubs(plans.filter(p => planIds.includes(p.id)))
        } else {
          setEditingUserSubs([])
        }
      }).catch(() => { if (isMountedRef.current) setEditingUserSubs([]) })
    }
  }, [editingId, isModalOpen, plans])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: UserCreateForm = {
        username: values.username || '',
        email: values.email,
        password: values.password || '',
        role: values.role ?? 1,
        group: values.group,
      }
      return createUser(payload)
    },
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '创建失败'); return }
      message.success('创建成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => { message.error(error.message) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: FormValues }) => {
      const payload: UserUpdateForm = {
        email: values.email,
        role: values.role,
        status: values.status,
        group: values.group,
        quota: values.quota,
      }
      return updateUser(id, payload)
    },
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '更新失败'); return }
      message.success('更新成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => { message.error(error.message) },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '删除失败'); return }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => { message.error(error.message) },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteUsers,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '批量删除失败'); return }
      message.success('批量删除成功')
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => { message.error(error.message) },
  })

  const batchStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: number }) => batchUpdateUserStatus(ids, status),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '批量更新状态失败'); return }
      message.success('批量更新状态成功')
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => { message.error(error.message) },
  })

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) => updateUser(id, { status }),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '操作失败'); return }
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const passwordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => setUserPassword(id, password),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '修改失败'); return }
      message.success('密码已重置')
    },
    onError: (error: Error) => message.error(error.message),
  })

  const adjustMutation = useMutation({
    mutationFn: ({ id, amount, description }: { id: number; amount: number; description?: string }) =>
      adjustUserQuota(id, amount, description),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '调整失败'); return }
      message.success('额度调整成功')
      setQuotaModalOpen(false)
      quotaForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['quotaTransactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const subscribeMutation = useMutation({
    mutationFn: ({ userId, planId }: { userId: number; planId: number }) => subscribeUser(userId, planId),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '开通失败'); return }
      message.success('套餐开通成功')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['quotaTransactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] })
      queryClient.invalidateQueries({ queryKey: ['relay', 'subscription-plans'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const handleSubmit = (values: FormValues) => {
    if (createMutation.isPending || updateMutation.isPending || passwordMutation.isPending) return
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, values }, {
        onSuccess: () => {
          // Chain password change after update succeeds to avoid partial state
          if (values.newPassword && values.newPassword.trim()) {
            passwordMutation.mutate({ id: editingId, password: values.newPassword })
          }
        }
      })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleOpenModal = () => {
    setEditingId(null)
    setEditingUserSubs([])
    setEditTab('basic')
    form.setFieldsValue(defaultCreateValues)
    setTimeout(() => { initialValuesRef.current = JSON.stringify(form.getFieldsValue()) }, 0)
    setIsModalOpen(true)
  }

  const handleEdit = (record: User) => {
    setEditingId(record.id)
    setEditTab('basic')
    form.setFieldsValue({
      email: record.email,
      role: record.role,
      status: record.status,
      group: record.group,
      quota: record.quota,
      newPassword: '',
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
          setEditingUserSubs([])
          setEditTab('basic')
          form.resetFields()
        },
      })
    } else {
      closeForceRef.current = false
      setIsModalOpen(false)
      setEditingId(null)
      setEditingUserSubs([])
      setEditTab('basic')
      form.resetFields()
    }
  }

  const handleOpenQuota = (record: User) => {
    setQuotaUserId(record.id)
    quotaForm.resetFields()
    setQuotaModalOpen(true)
  }

  const handleAdjustQuota = (values: { amount: number; description: string }) => {
    if (!quotaUserId) return
    adjustMutation.mutate({ id: quotaUserId, amount: values.amount, description: values.description })
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '邮箱', dataIndex: 'email', render: (email: string) => email || '-' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: number) => (
        <Tag color={ROLE_COLOR[role] ?? 'default'}>
          {ROLE_MAP[role] ?? role}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: number, record: User) => (
        <Space>
          <Popconfirm
            title={`确定要${status === 1 ? '禁用' : '启用'}该用户吗？`}
            onConfirm={() => toggleUserStatusMutation.mutate({ id: record.id, status: status === 1 ? 0 : 1 })}
          >
            <Switch
              checked={status === 1}
              size="small"
              loading={toggleUserStatusMutation.isPending && toggleUserStatusMutation.variables?.id === record.id}
            />
          </Popconfirm>
          <Tag color={status === 1 ? 'green' : 'red'}>
            {STATUS_MAP[status] ?? status}
          </Tag>
        </Space>
      ),
    },
    { title: '分组', dataIndex: 'group', render: (group: string) => group || '-' },
    {
      title: '额度使用',
      key: 'quota_usage',
      width: 220,
      render: (_: unknown, record: User) => {
        const percent = record.quota > 0 ? Math.round(record.used_quota / record.quota * 100) : 0
        return (
          <Progress
            percent={Math.min(percent, 100)}
            size="small"
            format={() => `${formatNumber(record.used_quota)} / ${formatNumber(record.quota)}`}
          />
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_: unknown, record: User) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => handleOpenQuota(record)}>
            额度
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              handleEdit(record)
              // Delay opening quota sub-modal
            }}
          >
            订阅
          </Button>
          <Button
            type="link"
            danger
            size="small"
            loading={deleteMutation.isPending && deleteMutation.variables === record.id}
            onClick={() =>
              openConfirm(
                '确认删除用户',
                `确定删除用户 "${record.username}" 吗？此操作不可撤销。`,
                () => deleteMutation.mutate(record.id),
              )
            }
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const modalTitle = editingId !== null ? '编辑用户' : '新增用户'
  const submitLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索用户名/邮箱"
          onSearch={(v) => { setKeyword(v); setPage(1) }}
          style={{ width: 300 }}
          allowClear
        />
        <Space>
          <Button onClick={() => exportCSV(data?.data?.data || [])}>导出 CSV</Button>
          <Button onClick={() => setImportModalOpen(true)}>批量导入</Button>
          <Button type="primary" onClick={handleOpenModal}>
            新增用户
          </Button>
        </Space>
      </div>

      {selectedIds.length > 0 && (
        <Space style={{ marginBottom: 16 }}>
          <span>已选择 {selectedIds.length} 项</span>
          <Popconfirm
            title={`确定要批量启用选中的 ${selectedIds.length} 个用户吗？`}
            onConfirm={() => batchStatusMutation.mutate({ ids: selectedIds, status: 1 })}
          >
            <Button>批量启用</Button>
          </Popconfirm>
          <Popconfirm
            title={`确定要批量禁用选中的 ${selectedIds.length} 个用户吗？`}
            onConfirm={() => batchStatusMutation.mutate({ ids: selectedIds, status: 0 })}
          >
            <Button>批量禁用</Button>
          </Popconfirm>
          <Button
            danger
            loading={batchDeleteMutation.isPending}
            onClick={() =>
              openConfirm(
                '确认批量删除',
                `确定删除选中的 ${selectedIds.length} 个用户吗？此操作不可撤销。`,
                () => batchDeleteMutation.mutate(selectedIds),
              )
            }
          >
            批量删除
          </Button>
        </Space>
      )}

      {!isLoading && (data?.data?.data || []).length === 0 ? (
        <EmptyState
          description="暂无用户数据"
          actionText="新增用户"
          onAction={handleOpenModal}
        />
      ) : (
        <Table
          scroll={{ x: 'max-content' }}
          loading={isLoading}
          dataSource={data?.data?.data || []}
          rowKey="id"
          size="middle"
          pagination={{
            current: page,
            pageSize: 20,
            total: data?.data?.pagination?.total || 0,
            onChange: setPage,
            showTotal: (total) => `共 ${total} 条`,
          }}
          columns={columns}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as number[]),
          }}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={handleCloseModal}
        onOk={async () => { try { await form.submit() } catch { /* validation failed, Ant Design shows inline errors */ } }}
        confirmLoading={submitLoading}
        width={editingId !== null ? 700 : 600}
      >
        <Tabs activeKey={editTab} onChange={setEditTab} items={[
          {
            key: 'basic',
            label: '基本信息',
            children: (
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={defaultCreateValues}
              >
                {editingId === null && (
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input placeholder="用户名" />
                  </Form.Item>
                )}

                <Form.Item
                  label="邮箱"
                  name="email"
                  rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
                >
                  <Input placeholder="邮箱" />
                </Form.Item>

                {editingId === null && (
                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 8, message: '密码长度至少 8 位' },
                    ]}
                  >
                    <Input.Password placeholder="密码" />
                  </Form.Item>
                )}

                <Form.Item
                  label="角色"
                  name="role"
                  rules={[{ required: true, message: '请选择角色' }]}
                >
                  <Select options={ROLE_OPTIONS} placeholder="选择角色" />
                </Form.Item>

                {editingId !== null && (
                  <Form.Item
                    label="状态"
                    name="status"
                    rules={[{ required: true, message: '请选择状态' }]}
                  >
                    <Select options={STATUS_OPTIONS} placeholder="选择状态" />
                  </Form.Item>
                )}

                <Form.Item label="分组" name="group">
                  <Select
                    mode="tags"
                    maxCount={1}
                    placeholder="选择或输入分组"
                    options={groupOptions.map(g => ({ value: g, label: g }))}
                  />
                </Form.Item>

                {editingId !== null && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />

                    <Form.Item label="额度" name="quota" help="直接设置用户额度">
                      <InputNumber min={0} max={99999999} style={{ width: '100%' }} placeholder="额度" />
                    </Form.Item>

                    <Form.Item label="重置密码" name="newPassword" help="留空则不修改密码" rules={[
                      { min: 8, message: '密码长度至少 8 位' },
                      { max: 128, message: '密码长度不能超过 128 位' },
                    ]}>
                      <Input.Password placeholder="新密码（选填）" />
                    </Form.Item>

                    {/* Subscription section */}
                    <Form.Item label="当前订阅">
                      {editingUserSubs.length > 0 ? (
                        <Space wrap>
                          {editingUserSubs.map(p => (
                            <Tag key={p.id} color="cyan">{p.name}</Tag>
                          ))}
                        </Space>
                      ) : (
                        <span style={{ color: '#999' }}>暂无订阅</span>
                      )}
                    </Form.Item>

                    <Form.Item label="开通套餐">
                      <Select
                        placeholder="选择套餐开通"
                        allowClear
                        options={plans
                          .filter(p => !editingUserSubs.some(s => s.id === p.id))
                          .map(p => ({
                            value: p.id,
                            label: `${p.name} (¥${(p.price_cents / 100).toFixed(2)}/${p.interval_months}月)`,
                          }))}
                        onChange={(planId) => {
                          if (planId && editingId) {
                            subscribeMutation.mutate({ userId: editingId, planId })
                          }
                        }}
                      />
                    </Form.Item>
                  </>
                )}
              </Form>
            ),
          },
          ...(editingId !== null ? [{
            key: 'finance',
            label: '财务概览',
            children: <UserFinanceTab userId={editingId} onViewAllTransactions={() => {
              handleCloseModal()
              navigate('/quota-transactions')
            }} />,
          }] : []),
        ]} />
      </Modal>

      {/* Quota Adjustment Modal */}
      <Modal
        title="额度调整"
        open={quotaModalOpen}
        onCancel={() => { setQuotaModalOpen(false); quotaForm.resetFields() }}
        onOk={() => quotaForm.submit()}
        confirmLoading={adjustMutation.isPending}
      >
        <Form form={quotaForm} layout="vertical" onFinish={handleAdjustQuota}>
          <Form.Item
            label="调整额度"
            name="amount"
            rules={[{ required: true, message: '请输入调整额度' }]}
            help="正数为增加额度，负数为扣除额度"
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如：10000（增加1万额度）"
              min={-99999999}
              max={99999999}
            />
          </Form.Item>
          <Form.Item label="备注" name="description">
            <Input placeholder="调整原因（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* CSV Import Modal */}
      <CsvImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="批量导入用户"
        templateColumns={['username', 'password', 'role', 'quota']}
        templateUrl="/api/import/users"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />

      {/* Confirm Password Modal */}
      <ConfirmPasswordModal
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDesc}
        onConfirm={() => {
          pendingActionRef.current?.()
          pendingActionRef.current = null
          setConfirmOpen(false)
        }}
        onCancel={() => {
          pendingActionRef.current = null
          setConfirmOpen(false)
        }}
      />
    </div>
  )
}
