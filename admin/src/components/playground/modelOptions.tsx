import type React from 'react'
import { Space, Tag } from 'antd'
import type { Model } from '../../api/model'

export interface ModelOption {
  value: string
  label: React.ReactNode
}

/** Build model options for Select from the Model list */
export function buildModelOptions(models: Model[]): ModelOption[] {
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
