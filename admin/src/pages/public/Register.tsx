import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, App } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { register, getCaptcha } from '../../api/auth'
import { useThemeStore } from '../../stores/themeStore'

export default function Register() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const isDark = useThemeStore((s) => s.theme) === 'dark'

  const refreshCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    try {
      const res = await getCaptcha()
      if (res.code === 0 && res.data) {
        setCaptchaId(res.data.captcha_id)
        setCaptchaImage(res.data.image)
      }
    } catch {
      // ignore
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  const initRef = useRef(false)
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true
      refreshCaptcha()
    }
  }, [refreshCaptcha])

  const onFinish = async (values: {
    username: string
    email: string
    password: string
    confirm_password: string
    captcha_code: string
  }) => {
    if (values.password !== values.confirm_password) {
      message.error('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const res = await register({
        username: values.username,
        email: values.email,
        password: values.password,
        captcha_id: captchaId,
        captcha_code: values.captcha_code,
      })
      if (res.code !== 0) {
        message.error(res.message || '注册失败')
        refreshCaptcha()
        return
      }
      navigate(`/register-success?email=${encodeURIComponent(values.email)}`)
    } catch (e: any) {
      message.error(e.message)
      refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark ? '#141414' : '#f0f2f5',
      }}
    >
      <Card title="注册 Juhe Studio" style={{ maxWidth: 400, width: '100%' }}>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 32, message: '用户名长度 3-32 个字符' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码长度至少 8 位' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="confirm_password"
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item label="验证码" name="captcha_code" rules={[{ required: true, message: '请输入验证码' }]}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Input placeholder="请输入验证码" style={{ flex: 1 }} />
              <div
                role="button"
                tabIndex={0}
                onClick={refreshCaptcha}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    refreshCaptcha()
                  }
                }}
                style={{
                  height: 40,
                  width: 120,
                  borderRadius: 6,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: isDark ? '#2a2a2a' : '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="点击刷新验证码"
              >
                {captchaLoading ? (
                  <ReloadOutlined spin style={{ color: '#999' }} />
                ) : captchaImage ? (
                  <img src={captchaImage} alt="验证码" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ReloadOutlined style={{ color: '#999' }} />
                )}
              </div>
            </div>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            注册
          </Button>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          已有账号？<a onClick={() => navigate('/login')}>返回登录</a>
        </div>
      </Card>
    </div>
  )
}
