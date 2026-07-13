import { Card, Descriptions, Form, Input, Button, App, Spin, Tag, Alert } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe, updatePassword } from '../../api/auth'

interface PasswordForm {
  old_password: string
  new_password: string
  confirm_password: string
}

const ROLE_MAP: Record<number, { label: string; color: string }> = {
  1: { label: '用户', color: 'blue' },
  10: { label: '管理员', color: 'purple' },
  100: { label: '超级管理员', color: 'red' },
}

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '禁用', color: 'red' },
  1: { label: '启用', color: 'green' },
}

export default function Profile() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<PasswordForm>()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe(),
  })

  const mutation = useMutation({
    mutationFn: updatePassword,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '修改失败')
        return
      }
      message.success('密码修改成功')
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const handleSubmit = (values: PasswordForm) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的新密码不一致')
      return
    }
    mutation.mutate({
      old_password: values.old_password,
      new_password: values.new_password,
    })
  }

  const user = data?.data

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (isError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="加载失败"
          description={error?.message || '个人信息加载失败，请稍后重试'}
          showIcon
        />
      </div>
    )
  }

  const roleInfo = ROLE_MAP[user?.role ?? -1]
  const statusInfo = STATUS_MAP[user?.status ?? -1]

  return (
    <div>
      <Spin spinning={isLoading}>
        <Card title="个人信息" style={{ marginBottom: 24 }}>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="用户ID">{user?.id ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="用户名">{user?.username ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="角色">
              {roleInfo ? <Tag color={roleInfo.color}>{roleInfo.label}</Tag> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {statusInfo ? <Tag color={statusInfo.color}>{statusInfo.label}</Tag> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="分组">{user?.group ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{user?.email ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="总额度">{user?.quota ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="已用额度">{user?.used_quota ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{user?.created_at ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{user?.updated_at ?? '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Spin>

      <Card title="修改密码">
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 480 }}>
          <Form.Item
            label="当前密码"
            name="old_password"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="当前密码" />
          </Form.Item>

          <Form.Item
            label="新密码"
            name="new_password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码长度至少 8 位' },
            ]}
          >
            <Input.Password placeholder="新密码（至少 8 位）" />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirm_password"
            rules={[{ required: true, message: '请确认新密码' }]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={mutation.isPending}>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
