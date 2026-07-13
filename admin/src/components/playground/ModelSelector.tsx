import { Select, Typography, Space, Tag, Spin } from 'antd'
import type { Model } from '../../api/model'

const { Text } = Typography

interface ModelOption {
  value: string
  label: React.ReactNode
}

interface ModelSelectorProps {
  compareMode: boolean
  model: string
  modelB: string
  modelsLoading: boolean
  modelOptions: ModelOption[]
  onModelAChange: (val: string) => void
  onModelBChange: (val: string) => void
}

export default function ModelSelector({
  compareMode,
  model,
  modelB,
  modelsLoading,
  modelOptions,
  onModelAChange,
  onModelBChange,
}: ModelSelectorProps) {
  if (compareMode) {
    return (
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
            模型 A
          </Text>
          <Select
            value={model || undefined}
            onChange={onModelAChange}
            loading={modelsLoading}
            options={modelOptions}
            style={{ width: '100%' }}
            placeholder="模型 A"
            showSearch
            optionFilterProp="label"
            notFoundContent={modelsLoading ? <Spin size="small" /> : '无可用模型'}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
            模型 B
          </Text>
          <Select
            value={modelB || undefined}
            onChange={onModelBChange}
            loading={modelsLoading}
            options={modelOptions}
            style={{ width: '100%' }}
            placeholder="模型 B"
            showSearch
            optionFilterProp="label"
            notFoundContent={modelsLoading ? <Spin size="small" /> : '无可用模型'}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
        模型选择
      </Text>
      <Select
        value={model || undefined}
        onChange={onModelAChange}
        loading={modelsLoading}
        options={modelOptions}
        style={{ width: '100%' }}
        placeholder="选择模型"
        showSearch
        optionFilterProp="label"
        notFoundContent={modelsLoading ? <Spin size="small" /> : '无可用模型'}
      />
    </div>
  )
}

/** Build model options for Select from the Model list */
export function buildModelOptions(models: Model[]) {
  return models
    .filter((m) => m.status !== 0)
    .map((m) => ({
      value: m.model_name,
      label: (
        <Space>
          <span>{m.display_name || m.model_name}</span>
          {m.capabilities?.slice(0, 2).map((cap: string) => (
            <Tag key={cap} color="blue" style={{ fontSize: 10, lineHeight: '16px', marginRight: 0 }}>
              {cap}
            </Tag>
          ))}
        </Space>
      ),
    }))
}
