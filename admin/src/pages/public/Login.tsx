import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Typography, App } from 'antd'
import { ThunderboltOutlined, ApartmentOutlined, SafetyCertificateOutlined, GlobalOutlined, ReloadOutlined } from '@ant-design/icons'
import { AxiosError } from 'axios'
import { login, getMe, getCaptcha } from '../../api/auth'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'

const features = [
  { icon: <ThunderboltOutlined />, title: '多模型接入', desc: '支持 OpenAI、Anthropic、Gemini 等 20+ 渠道' },
  { icon: <ApartmentOutlined />, title: '智能路由', desc: '加权随机分发 + 跨组重试，保障高可用' },
  { icon: <SafetyCertificateOutlined />, title: '精细计费', desc: 'Token 计费 / 固定价 / 阶梯价，实时扣费' },
  { icon: <GlobalOutlined />, title: 'OpenAI 兼容', desc: '标准 API 格式，零修改接入现有工具链' },
]

export default function Login() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const [loading, setLoading] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

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

  const onFinish = async (values: { username: string; password: string; captcha_code: string }) => {
    setLoading(true)
    try {
      const res = await login({ ...values, captcha_id: captchaId })
      if (res.code !== 0 || !res.data?.token) {
        message.error(res.message || '登录失败')
        refreshCaptcha()
        return
      }
      setToken(res.data.token)
      try {
        const me = await getMe()
        if (me.data) setUser(me.data)
      } catch {
        message.error('获取用户信息失败，请重新登录')
        logout()
        refreshCaptcha()
        return
      }
      navigate('/dashboard')
    } catch (e: unknown) {
      if (e instanceof AxiosError && !e.response) {
        message.error('无法连接服务器，请检查网络连接')
      } else if (e instanceof AxiosError) {
        message.error(e.response?.data?.message || e.message)
      } else {
        message.error((e as Error).message)
      }
      refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: isDark ? '#0a0a0a' : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      }}
    >
      {/* Left panel — branding */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 80px',
          color: '#fff',
          maxWidth: 560,
          width: '100%',
        }}
      >
        <div style={{ marginBottom: 48 }}>
          <Typography.Title level={1} style={{ color: '#fff', marginBottom: 8, fontSize: 36 }}>
            Juhe Studio
          </Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16 }}>
            AI 管理中台 — 统一接入、智能路由、精细运营
          </Typography.Text>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {features.map((f) => (
            <div key={f.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {f.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDark ? '#141414' : '#fff',
          borderRadius: '24px 0 0 24px',
          boxShadow: isDark ? 'none' : '-8px 0 40px rgba(0,0,0,0.1)',
          maxWidth: 500,
          width: '100%',
        }}
      >
        <div style={{ width: 360, padding: '40px 0' }}>
          <Typography.Title level={2} style={{ marginBottom: 8, textAlign: 'center' }}>
            欢迎回来
          </Typography.Title>
          <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 32 }}>
            登录 Juhe Management 管理后台
          </Typography.Text>
          <Form onFinish={onFinish} layout="vertical" size="large">
            <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="请输入用户名" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password placeholder="请输入密码" />
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
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ marginTop: 8 }}>
              登 录
            </Button>
          </Form>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Typography.Text type="secondary">还没有账号？</Typography.Text>{' '}
            <a onClick={() => navigate('/register')} style={{ fontWeight: 500 }}>
              注册账号
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
