import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button, Result, message, Card, theme } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { resendVerification } from '../../api/auth'
import { useThemeStore } from '../../stores/themeStore'

export default function RegisterSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const email = searchParams.get('email') || ''
  const isDark = useThemeStore((s) => s.theme) === 'dark'
  const { token } = theme.useToken()

  const [resending, setResending] = useState(false)

  const handleResend = async () => {
    if (!email) {
      message.error('邮箱地址无效')
      return
    }
    setResending(true)
    try {
      await resendVerification({ email })
      message.success('验证邮件已重新发送，请查收')
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '重新发送失败')
    } finally {
      setResending(false)
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
      <Card style={{ width: 480 }}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
          <h2 style={{ marginBottom: 12 }}>注册成功！</h2>
          <p style={{ color: token.colorTextSecondary, fontSize: 14, marginBottom: 8 }}>
            验证邮件已发送到 <strong>{email}</strong>，请查收邮件并点击验证链接完成注册。
          </p>
          <p style={{ color: token.colorTextTertiary, fontSize: 13, marginBottom: 24 }}>
            未收到邮件？请检查垃圾箱或
            <Button
              type="link"
              size="small"
              onClick={handleResend}
              loading={resending}
              style={{ padding: 0, fontSize: 13 }}
            >
              重新发送验证邮件
            </Button>
          </p>
          <Result
            status="success"
            style={{ padding: 0 }}
            extra={
              <Button type="primary" onClick={() => navigate('/login')}>
                返回登录
              </Button>
            }
          />
        </div>
      </Card>
    </div>
  )
}
