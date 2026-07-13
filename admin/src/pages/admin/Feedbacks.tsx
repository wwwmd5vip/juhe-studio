import { useState } from 'react'
import { Table, Button, Space, Tag, Popconfirm, App, Select, DatePicker, Modal, Descriptions, Typography } from 'antd'
import { MessageOutlined, EyeOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { listFeedbacks, deleteFeedback, type Feedback, type FeedbackFilter } from '../../api/feedback'
import EmptyState from '../../components/EmptyState'

const { Paragraph } = Typography

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  bug: { label: '缺陷', color: '#ff4d4f' },
  feature: { label: '建议', color: '#52c41a' },
  other: { label: '其他', color: '#fa8c16' },
}

export default function Feedbacks() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [type, setType] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [detailFeedback, setDetailFeedback] = useState<Feedback | null>(null)

  const filter: FeedbackFilter = {
    type,
    start_date: dateRange?.[0],
    end_date: dateRange?.[1],
  }

  const { data, isLoading } = useQuery({
    queryKey: ['feedbacks', page, filter],
    queryFn: () => listFeedbacks(page, 20, filter),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteFeedback,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '删除失败')
        return
      }
      message.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['feedbacks'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const feedbacks = data?.data?.data ?? []
  const pagination = data?.data?.pagination

  return (
    <div>
      <h1>
        <MessageOutlined /> 用户反馈
      </h1>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder='反馈类型'
          allowClear
          style={{ width: 120 }}
          value={type}
          onChange={(v) => {
            setType(v)
            setPage(1)
          }}
          options={Object.entries(TYPE_MAP).map(([value, { label }]) => ({
            value,
            label,
          }))}
        />
        <DatePicker.RangePicker
          value={
            dateRange
              ? [dayjs(dateRange[0]), dayjs(dateRange[1])]
              : null
          }
          onChange={(dates) => {
            setDateRange(
              dates?.[0] && dates?.[1]
                ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
                : null,
            )
            setPage(1)
          }}
        />
      </Space>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>
      ) : feedbacks.length === 0 ? (
        <EmptyState description='暂无用户反馈' />
      ) : (
        <Table
          dataSource={feedbacks}
          rowKey='id'
          pagination={
            pagination
              ? {
                  current: pagination.page,
                  pageSize: pagination.page_size,
                  total: pagination.total,
                  onChange: (p) => setPage(p),
                }
              : false
          }
          columns={[
            {
              title: 'ID',
              dataIndex: 'id',
              width: 80,
            },
            {
              title: '类型',
              dataIndex: 'type',
              width: 100,
              render: (v: string) => {
                const cfg = TYPE_MAP[v]
                return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
              },
            },
            {
              title: '标题',
              dataIndex: 'title',
              ellipsis: true,
              render: (title: string, record: Feedback) => (
                <a onClick={() => setDetailFeedback(record)}>{title}</a>
              ),
            },
            {
              title: '内容',
              dataIndex: 'content',
              ellipsis: true,
              width: 300,
            },
            {
              title: '联系方式',
              dataIndex: 'contact',
              width: 160,
              ellipsis: true,
            },
            {
              title: '版本',
              dataIndex: 'app_version',
              width: 100,
            },
            {
              title: '系统',
              dataIndex: 'os',
              width: 80,
            },
            {
              title: '时间',
              dataIndex: 'created_at',
              width: 180,
              render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
            },
            {
              title: '操作',
              width: 120,
              render: (_: unknown, record: Feedback) => (
                <Space>
                  <Button
                    type='link'
                    size='small'
                    icon={<EyeOutlined />}
                    onClick={() => setDetailFeedback(record)}
                  >
                    详情
                  </Button>
                  <Popconfirm
                    title='确定删除此反馈？'
                    onConfirm={() => deleteMutation.mutate(record.id)}
                  >
                    <Button type='link' danger size='small'>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      )}

      <Modal
        title='反馈详情'
        open={!!detailFeedback}
        onCancel={() => setDetailFeedback(null)}
        footer={null}
        width={640}
      >
        {detailFeedback && (
          <Descriptions column={1} bordered size='small'>
            <Descriptions.Item label='ID'>{detailFeedback.id}</Descriptions.Item>
            <Descriptions.Item label='类型'>
              {(() => {
                const cfg = TYPE_MAP[detailFeedback.type]
                return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : detailFeedback.type
              })()}
            </Descriptions.Item>
            <Descriptions.Item label='标题'>
              {detailFeedback.title}
            </Descriptions.Item>
            <Descriptions.Item label='反馈内容'>
              <Paragraph
                style={{ marginBottom: 0, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}
              >
                {detailFeedback.content}
              </Paragraph>
            </Descriptions.Item>
            {detailFeedback.contact && (
              <Descriptions.Item label='联系方式'>
                {detailFeedback.contact}
              </Descriptions.Item>
            )}
            {detailFeedback.app_version && (
              <Descriptions.Item label='应用版本'>
                {detailFeedback.app_version}
              </Descriptions.Item>
            )}
            {detailFeedback.os && (
              <Descriptions.Item label='操作系统'>
                {detailFeedback.os}
              </Descriptions.Item>
            )}
            <Descriptions.Item label='提交时间'>
              {dayjs(detailFeedback.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
