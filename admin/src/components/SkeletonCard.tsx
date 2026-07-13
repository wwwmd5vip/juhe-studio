import { Card, Skeleton } from 'antd'

interface SkeletonCardProps {
  /** 是否显示为图表骨架（更大尺寸） */
  chart?: boolean
}

export default function SkeletonCard({ chart = false }: SkeletonCardProps) {
  return (
    <Card style={{ marginTop: 16, borderRadius: 12 }}>
      <Skeleton.Input active size="small" style={{ width: 120, marginBottom: 16 }} />
      <Skeleton active paragraph={{ rows: chart ? 6 : 3 }} />
    </Card>
  )
}
