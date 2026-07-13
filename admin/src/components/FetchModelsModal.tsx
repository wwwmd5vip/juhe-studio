import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Input, Table, Select, Checkbox, Space, Typography, Tag } from 'antd'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'

const MODEL_TYPES = [
  { value: 'llm', label: 'LLM' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'embedding', label: 'Embedding' },
]

const CAPABILITY_LABELS: Record<string, string> = {
  'function-call': '函数调用',
  vision: '视觉',
  reasoning: '推理',
  'image-generation': '图像生成',
  'image-input': '图像输入',
  'audio-input': '音频输入',
  'audio-output': '音频输出',
  'video-input': '视频输入',
  'video-generation': '视频生成',
  embedding: '嵌入',
  rerank: '重排序',
  'web-search': '联网搜索',
  'structured-output': '结构化输出',
}

export interface FetchModelItem {
  model_name: string
  type: string
  capabilities?: string[]
}

interface FetchModelsModalProps {
  open: boolean
  fetchedModels: string[]
  existingModels: string[]
  existingTypes: Record<string, string>
  fetchedCapabilities?: Record<string, string[]>
  onCancel: () => void
  onOk: (models: FetchModelItem[]) => void
  confirmLoading?: boolean
}

export default function FetchModelsModal({
  open,
  fetchedModels,
  existingModels,
  existingTypes,
  fetchedCapabilities,
  onCancel,
  onOk,
  confirmLoading,
}: FetchModelsModalProps) {
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [types, setTypes] = useState<Record<string, string>>({})

  // Prepopulate state when modal opens — guarded by prevOpenRef to avoid
  // cascading renders (the lint rule is overly strict here; this is the
  // standard React pattern for initialising controlled-modal state).
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setKeyword('')
      setSelected(new Set(fetchedModels.filter((m) => existingModels.includes(m))))
      const t: Record<string, string> = {}
      fetchedModels.forEach((m) => {
        t[m] = existingTypes[m] || 'llm'
      })
      setTypes(t)
    }
    prevOpenRef.current = open
  }, [open, fetchedModels, existingModels, existingTypes])

  const filteredModels = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return fetchedModels
    return fetchedModels.filter((m) => m.toLowerCase().includes(kw))
  }, [fetchedModels, keyword])

  const allFilteredSelected = useMemo(
    () => filteredModels.length > 0 && filteredModels.every((m) => selected.has(m)),
    [filteredModels, selected],
  )

  const removedCount = useMemo(
    () => existingModels.filter((m) => !fetchedModels.includes(m)).length,
    [existingModels, fetchedModels],
  )

  const handleToggleAll = (e: CheckboxChangeEvent) => {
    const checked = e.target.checked
    setSelected((prev) => {
      const next = new Set(prev)
      filteredModels.forEach((m) => {
        if (checked) next.add(m)
        else next.delete(m)
      })
      return next
    })
  }

  const handleToggle = (model: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(model)) next.delete(model)
      else next.add(model)
      return next
    })
  }

  const handleTypeChange = (model: string, value: string) => {
    setTypes((prev) => ({ ...prev, [model]: value }))
  }

  const handleOk = () => {
    const models: FetchModelItem[] = []
    selected.forEach((model) => {
      models.push({
        model_name: model,
        type: types[model] || 'llm',
        capabilities: fetchedCapabilities?.[model],
      })
    })
    onOk(models)
  }

  const columns = [
    {
      title: (
        <Checkbox
          checked={allFilteredSelected}
          indeterminate={!allFilteredSelected && filteredModels.some((m) => selected.has(m))}
          onChange={handleToggleAll}
        />
      ),
      dataIndex: 'model_name',
      key: 'checkbox',
      width: 50,
      render: (_: unknown, record: { model_name: string }) => (
        <Checkbox
          checked={selected.has(record.model_name)}
          onChange={() => handleToggle(record.model_name)}
        />
      ),
    },
    {
      title: 'Model Name',
      dataIndex: 'model_name',
      key: 'name',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: 'Type',
      key: 'type',
      width: 140,
      render: (_: unknown, record: { model_name: string }) => (
        <Select
          size="small"
          value={types[record.model_name] || 'llm'}
          onChange={(value) => handleTypeChange(record.model_name, value)}
          options={MODEL_TYPES}
          style={{ width: 120 }}
        />
      ),
    },
    {
      title: '能力',
      key: 'capabilities',
      width: 200,
      render: (_: unknown, record: { model_name: string }) => {
        const caps = fetchedCapabilities?.[record.model_name]
        if (!caps || caps.length === 0) return <Typography.Text type="secondary">—</Typography.Text>
        return (
          <Space size={2} wrap>
            {caps.map((c) => (
              <Tag key={c} style={{ margin: 0, fontSize: 11 }}>{CAPABILITY_LABELS[c] ?? c}</Tag>
            ))}
          </Space>
        )
      },
    },
  ]

  const dataSource = filteredModels.map((m) => ({ model_name: m, key: m }))

  return (
    <Modal
      title={
        <Space>
          <span>Fetch Upstream Models</span>
          {removedCount > 0 && (
            <Typography.Text type="secondary">
              ({removedCount} existing model{removedCount > 1 ? 's' : ''} no longer available)
            </Typography.Text>
          )}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={confirmLoading}
      width={700}
      destroyOnHidden
    >
      <Input.Search
        placeholder="Filter models..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        allowClear
        style={{ marginBottom: 16 }}
      />
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        scroll={{ y: 400 }}
        size="small"
        rowKey="model_name"
      />
    </Modal>
  )
}
