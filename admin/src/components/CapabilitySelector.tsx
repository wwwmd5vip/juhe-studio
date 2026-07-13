import { Tag, Typography, Space, theme } from 'antd'
import {
  EyeOutlined,
  BulbOutlined,
  AudioOutlined,
  GlobalOutlined,
  BarChartOutlined,
  VideoCameraOutlined,
  ToolOutlined,
} from '@ant-design/icons'

const { Text } = Typography

// OpenAI 协议能力分类
interface CapabilityCategory {
  key: string
  label: string
  icon: React.ReactNode
  color: string
  items: { value: string; label: string; desc: string }[]
}

const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  {
    key: 'tools',
    label: '对话 / 工具',
    icon: <ToolOutlined />,
    color: '#6366f1',
    items: [
      { value: 'function-call', label: '函数调用', desc: '支持 Function Calling / Tools' },
      { value: 'structured-output', label: '结构化输出', desc: 'JSON Mode / Structured Outputs' },
    ],
  },
  {
    key: 'vision',
    label: '视觉',
    icon: <EyeOutlined />,
    color: '#10b981',
    items: [
      { value: 'vision', label: '视觉理解', desc: '图像分析、OCR、多模态理解' },
      { value: 'image-input', label: '图像输入', desc: '支持图像作为输入' },
      { value: 'image-generation', label: '图像生成', desc: 'DALL·E / Stable Diffusion 等' },
    ],
  },
  {
    key: 'reasoning',
    label: '推理',
    icon: <BulbOutlined />,
    color: '#f59e0b',
    items: [
      { value: 'reasoning', label: '深度推理', desc: 'Chain-of-Thought、o1/o3 等推理模型' },
    ],
  },
  {
    key: 'audio',
    label: '音频',
    icon: <AudioOutlined />,
    color: '#ec4899',
    items: [
      { value: 'audio-input', label: '音频输入', desc: '语音识别 / 转录' },
      { value: 'audio-output', label: '音频输出', desc: 'TTS 语音合成' },
    ],
  },
  {
    key: 'web',
    label: '联网',
    icon: <GlobalOutlined />,
    color: '#3b82f6',
    items: [
      { value: 'web-search', label: '联网搜索', desc: '支持 Web Search / Grounding' },
    ],
  },
  {
    key: 'processing',
    label: '数据处理',
    icon: <BarChartOutlined />,
    color: '#8b5cf6',
    items: [
      { value: 'embedding', label: '嵌入', desc: '文本向量化 / Embedding' },
      { value: 'rerank', label: '重排序', desc: '搜索重排序 / Rerank' },
    ],
  },
  {
    key: 'video',
    label: '视频',
    icon: <VideoCameraOutlined />,
    color: '#ef4444',
    items: [
      { value: 'video-input', label: '视频输入', desc: '视频分析、帧提取' },
      { value: 'video-generation', label: '视频生成', desc: '文生视频、图生视频' },
    ],
  },
]

export const ALL_CAPABILITIES = CAPABILITY_CATEGORIES.flatMap((c) => c.items.map((i) => i.value))

interface CapabilitySelectorProps {
  value?: string[]
  onChange?: (value: string[]) => void
  disabled?: boolean
}

export default function CapabilitySelector({ value = [], onChange, disabled }: CapabilitySelectorProps) {
  const { token } = theme.useToken()
  const handleToggle = (cap: string) => {
    if (disabled) return
    const next = value.includes(cap) ? value.filter((v) => v !== cap) : [...value, cap]
    onChange?.(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {CAPABILITY_CATEGORIES.map((cat) => (
        <div key={cat.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ color: cat.color, fontSize: 14 }}>{cat.icon}</span>
            <Text strong style={{ fontSize: 13, color: token.colorTextSecondary }}>
              {cat.label}
            </Text>
          </div>
          <Space wrap size={[8, 8]}>
            {cat.items.map((item) => {
              const selected = value.includes(item.value)
              return (
                <Tag.CheckableTag
                  key={item.value}
                  checked={selected}
                  onChange={() => handleToggle(item.value)}
                  style={{
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                    border: selected
                      ? `1px solid ${cat.color}`
                      : `1px solid ${token.colorBorder}`,
                    background: selected ? `${cat.color}10` : undefined,
                    color: selected ? cat.color : undefined,
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    transition: 'all 0.2s',
                  }}
                >
                  {item.label}
                </Tag.CheckableTag>
              )
            })}
          </Space>
        </div>
      ))}
    </div>
  )
}

/** 能力标签小尺寸展示（用于表格列） */
export function CapabilityTags({ capabilities, max = 3 }: { capabilities: string[]; max?: number }) {
  if (!capabilities || capabilities.length === 0) {
    return <Text type="secondary">—</Text>
  }

  const flatItems = CAPABILITY_CATEGORIES.flatMap((c) => c.items)
  const labelMap = Object.fromEntries(flatItems.map((i) => [i.value, i.label]))
  const colorMap = Object.fromEntries(
    CAPABILITY_CATEGORIES.flatMap((c) => c.items.map((i) => [i.value, c.color])),
  )

  const visible = capabilities.slice(0, max)
  const overflow = capabilities.length - max

  return (
    <Space size={4} wrap>
      {visible.map((cap) => (
        <Tag
          key={cap}
          color={colorMap[cap]}
          style={{ margin: 0, fontSize: 11, padding: '0 6px', lineHeight: '20px' }}
        >
          {labelMap[cap] ?? cap}
        </Tag>
      ))}
      {overflow > 0 && (
        <Tag style={{ margin: 0, fontSize: 11, padding: '0 6px', lineHeight: '20px' }}>
          +{overflow}
        </Tag>
      )}
    </Space>
  )
}
