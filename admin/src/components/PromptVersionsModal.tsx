import { useState } from 'react'
import { Modal, Table, Button, Space, App } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPromptVersions, rollbackPrompt, type PromptVersion } from '../api/prompt'

interface Props {
  promptId: number | null
  open: boolean
  onClose: () => void
}

export default function PromptVersionsModal({ promptId, open, onClose }: Props) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['promptVersions', promptId, page],
    queryFn: () => listPromptVersions(promptId!, page, 10),
    enabled: open && promptId !== null,
  })

  const rollbackMutation = useMutation({
    mutationFn: ({ id, versionId }: { id: number; versionId: number }) =>
      rollbackPrompt(id, versionId),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '回滚失败')
        return
      }
      message.success('回滚成功')
      queryClient.invalidateQueries({ queryKey: ['promptVersions'] })
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      onClose()
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const columns = [
    { title: '版本ID', dataIndex: 'id' },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '内容',
      dataIndex: 'content',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags: string[]) => (tags || []).join(', ') || '-',
    },
    { title: '作者ID', dataIndex: 'author_id' },
    { title: '创建时间', dataIndex: 'created_at' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: PromptVersion) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            loading={
              rollbackMutation.isPending &&
              rollbackMutation.variables?.versionId === record.id
            }
            onClick={() =>
              rollbackMutation.mutate({ id: promptId!, versionId: record.id })
            }
          >
            回滚到此版本
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Modal
      title={`提示词版本历史 #${promptId}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <Table
        loading={isLoading}
        dataSource={data?.data?.data || []}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: 10,
          total: data?.data?.pagination?.total || 0,
          onChange: setPage,
        }}
        columns={columns}
      />
    </Modal>
  )
}
