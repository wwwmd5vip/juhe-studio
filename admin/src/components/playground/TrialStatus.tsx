import { Button, Tag, Typography } from 'antd'
import { ThunderboltOutlined } from '@ant-design/icons'
import type { UserMe } from '../../api/auth'

const { Text } = Typography

interface TrialStatusProps {
  user: UserMe | null
  isDark: boolean
}

export default function TrialStatus({ user, isDark }: TrialStatusProps) {
  if (!user) return null

  return (
    <div
      style={{
        marginBottom: 16,
        padding: '8px 12px',
        borderRadius: 8,
        background: isDark ? 'rgba(22, 119, 255, 0.1)' : '#e6f4ff',
        border: `1px solid ${isDark ? 'rgba(22, 119, 255, 0.25)' : '#91caff'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: isDark ? '#91caff' : '#1677ff' }}>
          <ThunderboltOutlined style={{ marginRight: 4 }} />
          试用
        </Text>
        <Tag color={user.quota > 0 ? 'green' : 'red'} style={{ fontSize: 10, lineHeight: '18px' }}>
          {user.quota > 0 ? `余额 ¥${(user.quota / 100).toFixed(2)}` : '余额不足'}
        </Tag>
      </div>
      <div style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: isDark ? '#a0a0a0' : '#666' }}>
          剩余免费次数：{Math.max(0, 5 - user.playground_trials_used)} / 5
        </Text>
      </div>
      {user.quota <= 0 && user.playground_trials_used >= 5 && (
        <Button
          type="primary"
          danger
          size="small"
          block
          style={{ marginTop: 8 }}
          onClick={() => window.open('/recharge', '_self')}
        >
          立即充值
        </Button>
      )}
    </div>
  )
}
