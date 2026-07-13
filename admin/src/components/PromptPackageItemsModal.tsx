import { useMemo, useState } from 'react'
import { Modal, Table, Button, Form, InputNumber, App } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPackageItems, setPackageItems, type PackageItemInput } from '../api/prompt'

interface Props {
  promptId: number | null
  open: boolean
  onClose: () => void
}

export default function PromptPackageItemsModal({ promptId, open, onClose }: Props) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<{ prompt_id: number | null; sort_order: number }>()
  const [added, setAdded] = useState<PackageItemInput[]>([])
  const [removed, setRemoved] = useState<Set<number>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['packageItems', promptId],
    queryFn: () => listPackageItems(promptId!),
    enabled: open && promptId !== null,
  })

  const currentItems: PackageItemInput[] = useMemo(() => {
    if (!data?.data) return []
    return data.data.map((it) => ({
      prompt_id: Number(it.prompt_id),
      sort_order: it.sort_order,
    }))
  }, [data])

  const displayedItems = useMemo(() => {
    const base = currentItems.filter((it) => !removed.has(it.prompt_id))
    return [...base, ...added].sort((a, b) => a.sort_order - b.sort_order)
  }, [currentItems, added, removed])

  const saveMutation = useMutation({
    mutationFn: ({ id, items }: { id: number; items: PackageItemInput[] }) =>
      setPackageItems(id, items),
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '保存失败')
        return
      }
      message.success('保存成功')
      setAdded([])
      setRemoved(new Set())
      queryClient.invalidateQueries({ queryKey: ['packageItems'] })
      onClose()
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const handleAdd = (values: { prompt_id: number | null; sort_order: number }) => {
    if (!values.prompt_id) {
      message.warning('请输入 Prompt ID')
      return
    }
    if (displayedItems.some((it) => it.prompt_id === values.prompt_id)) {
      message.warning('该 Prompt 已存在')
      return
    }
    setAdded([...added, { prompt_id: values.prompt_id, sort_order: values.sort_order }])
    form.resetFields()
  }

  const handleRemove = (idToRemove: number) => {
    if (added.some((it) => it.prompt_id === idToRemove)) {
      setAdded(added.filter((it) => it.prompt_id !== idToRemove))
      return
    }
    setRemoved(new Set([...removed, idToRemove]))
  }

  const handleClose = () => {
    setAdded([])
    setRemoved(new Set())
    onClose()
  }

  const columns = [
    { title: 'Prompt ID', dataIndex: 'prompt_id' },
    { title: '排序', dataIndex: 'sort_order' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: PackageItemInput) => (
        <Button type="link" danger size="small" onClick={() => handleRemove(record.prompt_id)}>
          移除
        </Button>
      ),
    },
  ]

  return (
    <Modal
      title={`封装项管理 #${promptId}`}
      open={open}
      onCancel={handleClose}
      onOk={() => {
        if (promptId !== null) {
          saveMutation.mutate({ id: promptId, items: displayedItems })
        }
      }}
      confirmLoading={saveMutation.isPending}
      width={640}
    >
      <Form
        form={form}
        layout="inline"
        onFinish={handleAdd}
        initialValues={{ prompt_id: null, sort_order: 0 }}
        style={{ marginBottom: 16 }}
      >
        <Form.Item label="Prompt ID" name="prompt_id" rules={[{ required: true, message: '必填' }]}>
          <InputNumber min={1} />
        </Form.Item>
        <Form.Item label="排序" name="sort_order">
          <InputNumber />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={async () => { try { await form.submit() } catch { /* validation failed */ } }}>
            添加
          </Button>
        </Form.Item>
      </Form>

      <Table
        loading={isLoading}
        dataSource={displayedItems}
        rowKey="prompt_id"
        pagination={false}
        columns={columns}
      />
    </Modal>
  )
}
