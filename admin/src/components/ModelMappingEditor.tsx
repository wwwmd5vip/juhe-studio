import { useEffect, useState, useCallback, useMemo } from 'react'
import { Tabs, AutoComplete, Button, Space, Typography, Input, App } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

interface ModelMappingEditorProps {
  value?: Record<string, string>
  onChange?: (value: Record<string, string>) => void
  modelOptions?: string[]
}

interface Entry {
  key: string
  value: string
}

function entriesFromRecord(record: Record<string, string> | undefined): Entry[] {
  if (!record) return []
  return Object.entries(record).map(([k, v]) => ({ key: k, value: v }))
}

function recordFromEntries(entries: Entry[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const e of entries) {
    if (e.key.trim()) {
      result[e.key.trim()] = e.value
    }
  }
  return result
}

function findDupes(entries: Entry[]): string[] {
  const seen = new Map<string, number>()
  const dupes: string[] = []
  for (const e of entries) {
    const k = e.key.trim()
    if (!k) continue
    const count = seen.get(k) || 0
    seen.set(k, count + 1)
    if (count === 1) dupes.push(k)
  }
  return dupes
}

export default function ModelMappingEditor({
  value,
  onChange,
  modelOptions = [],
}: ModelMappingEditorProps) {
  const { message } = App.useApp()
  const [entries, setEntries] = useState<Entry[]>(() => entriesFromRecord(value))
  const [activeTab, setActiveTab] = useState<string>('visual')
  const [jsonText, setJsonText] = useState<string>('')

  // Sync from external value change (form.resetFields / setFieldsValue)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(entriesFromRecord(value))
  }, [value])

  const dupes = useMemo(() => findDupes(entries), [entries])

  const handleKeyChange = useCallback(
    (index: number, newKey: string) => {
      setEntries((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], key: newKey }
        onChange?.(recordFromEntries(next))
        return next
      })
    },
    [onChange],
  )

  const handleValueChange = useCallback(
    (index: number, newValue: string) => {
      setEntries((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], value: newValue }
        onChange?.(recordFromEntries(next))
        return next
      })
    },
    [onChange],
  )

  const handleDelete = useCallback(
    (index: number) => {
      setEntries((prev) => {
        const next = prev.filter((_, i) => i !== index)
        onChange?.(recordFromEntries(next))
        return next
      })
    },
    [onChange],
  )

  const handleAdd = useCallback(() => {
    setEntries((prev) => {
      const next = [...prev, { key: '', value: '' }]
      return next
    })
  }, [])

  const handleTabChange = useCallback(
    (tab: string) => {
      if (tab === 'json') {
        // sync visual → JSON
        const record = recordFromEntries(entries)
        setJsonText(JSON.stringify(record, null, 2))
      } else if (tab === 'visual' && activeTab === 'json') {
        // sync JSON → visual
        try {
          const parsed = JSON.parse(jsonText.trim() || '{}')
          if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
            message.error('JSON 必须是一个对象')
            return
          }
          const result: Record<string, string> = {}
          for (const key of Object.keys(parsed)) {
            result[key] = String(parsed[key])
          }
          const next = entriesFromRecord(result)
          setEntries(next)
          onChange?.(result)
          setActiveTab(tab)
          return
        } catch {
          message.error('JSON 格式无效')
          return
        }
      }
      setActiveTab(tab)
    },
    [activeTab, entries, jsonText, message, onChange],
  )

  const filterOption = (input: string, option?: { value: string }) =>
    (option?.value ?? '').toLowerCase().includes(input.toLowerCase())

  const tabItems = [
    {
      key: 'visual',
      label: '可视化',
      children: (
        <div>
          {entries.length === 0 && (
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              暂无映射，点击下方按钮添加
            </Typography.Text>
          )}
          {entries.map((entry, index) => (
            <div key={index}>
              <Space align="start" style={{ display: 'flex', marginBottom: 8 }}>
                <AutoComplete
                  value={entry.key}
                  onChange={(val) => handleKeyChange(index, val)}
                  options={modelOptions.map((m) => ({ value: m }))}
                  filterOption={filterOption}
                  placeholder="系统模型"
                  style={{ width: 200 }}
                  allowClear
                />
                <Typography.Text
                  type="secondary"
                  style={{ lineHeight: '32px', userSelect: 'none' }}
                >
                  →
                </Typography.Text>
                <AutoComplete
                  value={entry.value}
                  onChange={(val) => handleValueChange(index, val)}
                  options={modelOptions.map((m) => ({ value: m }))}
                  filterOption={filterOption}
                  placeholder="上游模型"
                  style={{ width: 200 }}
                  allowClear
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(index)}
                  style={{ marginTop: 4 }}
                />
              </Space>
              {dupes.includes(entry.key.trim()) && entry.key.trim() && (
                <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: -4, marginBottom: 8 }}>
                  模型 {entry.key.trim()} 重复
                </Typography.Text>
              )}
            </div>
          ))}
          <Button
            type="dashed"
            onClick={handleAdd}
            icon={<PlusOutlined />}
            style={{ marginTop: 4 }}
          >
            添加映射
          </Button>
        </div>
      ),
    },
    {
      key: 'json',
      label: 'JSON',
      children: (
        <Input.TextArea
          rows={8}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{"gpt-4o": "openai-gpt-4o"}'
        />
      ),
    },
  ]

  return (
    <Tabs
      activeKey={activeTab}
      onChange={handleTabChange}
      items={tabItems}
      size="small"
    />
  )
}
