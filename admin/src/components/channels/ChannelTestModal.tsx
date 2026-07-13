import { Modal, Table, Tag } from 'antd'
import type { ChannelTestLog } from '../../api/channel'
import EmptyState from '../EmptyState'

interface ChannelTestModalProps {
  open: boolean
  channelId: number | null
  loading: boolean
  logs: ChannelTestLog[]
  total: number
  page: number
  onPageChange: (page: number) => void
  onClose: () => void
}

export default function ChannelTestModal({
  open,
  channelId,
  loading,
  logs,
  total,
  page,
  onPageChange,
  onClose,
}: ChannelTestModalProps) {
  return (
    <Modal
      title={`测试历史 - 渠道 #${channelId}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <Table<ChannelTestLog>
        loading={loading}
        dataSource={logs}
        rowKey="id"
        size="small"
        locale={{ emptyText: <EmptyState description="暂无测试记录" /> }}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条`,
          onChange: onPageChange,
        }}
        columns={[
          {
            title: '探测时间',
            dataIndex: 'probed_at',
            width: 180,
            render: (v: string) => v || '-',
          },
          {
            title: '结果',
            dataIndex: 'success',
            width: 80,
            render: (v: boolean) =>
              v ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>,
          },
          {
            title: '响应时间',
            dataIndex: 'response_time_ms',
            width: 100,
            render: (v: number) => `${v}ms`,
          },
          {
            title: '错误信息',
            dataIndex: 'error_message',
            ellipsis: true,
            render: (v?: string) => v || '-',
          },
        ]}
      />
    </Modal>
  )
}
