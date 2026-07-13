import { Skeleton, Card, theme } from 'antd'

interface SkeletonTableProps {
  rows?: number
  columns?: number
}

export default function SkeletonTable({ rows = 5, columns = 5 }: SkeletonTableProps) {
  const { token } = theme.useToken()
  return (
    <Card style={{ marginTop: 16, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Skeleton.Input active size="small" style={{ width: 200 }} />
        <Skeleton.Button active size="small" />
      </div>
      <Skeleton active paragraph={{ rows }} />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 16,
            padding: '8px 0',
            borderBottom: i < rows - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
          }}
        >
          {Array.from({ length: columns }, (_, j) => (
            <Skeleton.Input
              key={j}
              active
              size="small"
              style={{
                flex: j === columns - 1 ? 1 : undefined,
                width: j === 0 ? 40 : j === columns - 1 ? undefined : 80 + Math.random() * 60,
              }}
            />
          ))}
        </div>
      ))}
    </Card>
  )
}
