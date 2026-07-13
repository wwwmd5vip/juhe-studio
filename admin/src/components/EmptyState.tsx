import { Empty, Button, Typography, theme } from 'antd'
const { Title } = Typography

interface EmptyStateProps {
  title?: string
  description: string
  actionText?: string
  onAction?: () => void
}

export default function EmptyState({ title, description, actionText, onAction }: EmptyStateProps) {
  const { token } = theme.useToken()
  return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      {title && <Title level={5} style={{ marginBottom: 8, color: token.colorTextTertiary }}>{title}</Title>}
      <Empty description={description} image={Empty.PRESENTED_IMAGE_SIMPLE}>
        {actionText && onAction && <Button type="primary" onClick={onAction}>{actionText}</Button>}
      </Empty>
    </div>
  )
}
