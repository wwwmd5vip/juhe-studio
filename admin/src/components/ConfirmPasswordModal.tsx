import { useState } from 'react'
import { Modal, Form, Input, App, Button, theme } from 'antd'
import { verifyPassword } from '../api/auth'

interface ConfirmPasswordModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description: string
}

export default function ConfirmPasswordModal({
  open,
  onConfirm,
  onCancel,
  title,
  description,
}: ConfirmPasswordModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [form] = Form.useForm<{ password: string }>()
  const [verifying, setVerifying] = useState(false)
  const [passed, setPassed] = useState(false)

  const handleVerify = async () => {
    try {
      const values = await form.validateFields()
      setVerifying(true)
      const res = await verifyPassword(values.password)
      if (res.code === 0 && res.data?.valid) {
        setPassed(true)
        message.success('验证通过')
      } else {
        message.error(res.message || '密码错误')
      }
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message)
      }
    } finally {
      setVerifying(false)
    }
  }

  const handleCancel = () => {
    setPassed(false)
    form.resetFields()
    onCancel()
  }

  const handleOk = () => {
    if (passed) {
      onConfirm()
      setPassed(false)
      form.resetFields()
    }
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText={passed ? '确认执行' : '验证密码'}
      cancelText="取消"
      confirmLoading={verifying}
      okButtonProps={{ disabled: !passed }}
    >
      <div style={{ marginBottom: 16, color: token.colorTextSecondary }}>
        {description}
      </div>
      <Form form={form} layout="vertical">
        <Form.Item
          label="请输入管理员密码以确认操作"
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            placeholder="输入密码后点击验证"
            onPressEnter={handleVerify}
            disabled={passed}
          />
        </Form.Item>
        {!passed && (
          <Form.Item>
            <Button
              type="primary"
              block
              onClick={handleVerify}
              loading={verifying}
            >
              验证密码
            </Button>
          </Form.Item>
        )}
        {passed && (
          <div style={{ color: token.colorSuccess, marginBottom: 16 }}>
            ✅ 密码已验证通过，可以执行操作
          </div>
        )}
      </Form>
    </Modal>
  )
}
