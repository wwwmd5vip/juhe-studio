import { Card } from 'antd'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'
import type { ChannelLoadItem } from '../../api/channel'
import EmptyState from '../EmptyState'

interface ChannelLoadChartProps {
  loadChannels: ChannelLoadItem[]
  isDark: boolean
  loading: boolean
}

export default function ChannelLoadChart({ loadChannels, isDark, loading }: ChannelLoadChartProps) {
  return (
    <Card
      loading={loading}
      style={{ marginBottom: 16, background: isDark ? '#1f1f1f' : '#fff' }}
      title="渠道负载分布（最近1小时）"
    >
      {loadChannels.length === 0 ? (
        <EmptyState description="暂无负载数据" />
      ) : (
        <div style={{ height: Math.max(200, loadChannels.length * 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={loadChannels}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#333' : '#e0e0e0'} />
              <XAxis type="number" tick={{ fontSize: 11, fill: isDark ? '#bbb' : '#666' }} />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                tick={{ fontSize: 11, fill: isDark ? '#ddd' : '#333' }}
              />
              <RechartsTooltip
                contentStyle={{
                  background: isDark ? '#2a2a2a' : '#fff',
                  border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: any, name: any) => [
                  name === 'recent_requests_1h' ? `${value} 次` : `${Number(value).toFixed(1)}%`,
                  name === 'recent_requests_1h' ? '请求数(1h)' : '权重占比',
                ]}
              />
              <Bar dataKey="weight_pct" name="weight_pct" barSize={14}>
                {loadChannels.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={
                      entry.status === 1 ? '#1677ff' : entry.status === 0 ? '#999' : '#ff4d4f'
                    }
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
              <Bar dataKey="recent_requests_1h" name="recent_requests_1h" barSize={14} fill="#52c41a" fillOpacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
