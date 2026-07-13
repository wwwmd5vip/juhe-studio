import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Table, Input, Space, Select, Tag, DatePicker, Button, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useQuery } from '@tanstack/react-query'
import { useThemeStore } from '../../stores/themeStore'
import { listAuditLogs, type AuditLogItem } from '../../api/auditLog'
import EmptyState from '../../components/EmptyState'

const ACTION_MAP: Record<string, { label: string; color: string }> = {
  create: { label: '创建', color: 'green' },
  update: { label: '更新', color: 'blue' },
  delete: { label: '删除', color: 'red' },
}

const ACTION_OPTIONS = [
  { label: '全部', value: '' },
  { label: '创建', value: 'create' },
  { label: '更新', value: 'update' },
  { label: '删除', value: 'delete' },
]

const TARGET_TYPE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '用户', value: 'user' },
  { label: 'Token', value: 'token' },
  { label: '渠道', value: 'channel' },
  { label: '模型', value: 'model' },
  { label: '定价', value: 'pricing' },
  { label: '提示词', value: 'prompt' },
  { label: '额度包', value: 'quota_package' },
  { label: '兑换码', value: 'redemption' },
  { label: '订阅套餐', value: 'subscription_plan' },
  { label: '系统设置', value: 'setting' },
]

function formatJson(value?: string): string {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export default function AuditLogs() {
  const isDark = useThemeStore((s) => s.theme) === 'dark'
  const [page, setPage] = useState(1)
  const [operatorName, setOperatorName] = useState('')
  const [debouncedOperatorName, setDebouncedOperatorName] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const { message } = App.useApp()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Debounce operator name to avoid per-keystroke API calls
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedOperatorName(operatorName)
      setPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [operatorName])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', page, debouncedOperatorName, action, targetType, dateRange],
    queryFn: () =>
      listAuditLogs({
        page,
        page_size: 20,
        operator_name: debouncedOperatorName || undefined,
        action: action || undefined,
        target_type: targetType || undefined,
        start_date: dateRange?.[0],
        end_date: dateRange?.[1],
      }),
  })

  const rows = useMemo(() => data?.data?.data || [], [data])
  const total = useMemo(() => data?.data?.pagination?.total || 0, [data])

  const columns: ColumnsType<AuditLogItem> = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'created_at',
        width: 180,
        render: (value: string) =>
          value ? new Date(value).toLocaleString('zh-CN') : '-',
      },
      {
        title: '操作人',
        dataIndex: 'operator_name',
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '操作',
        dataIndex: 'action',
        width: 100,
        render: (value: string) => {
          const info = ACTION_MAP[value]
          return info ? (
            <Tag color={info.color}>{info.label}</Tag>
          ) : (
            value || '-'
          )
        },
      },
      {
        title: '目标类型',
        dataIndex: 'target_type',
        width: 140,
        render: (value: string) => {
          const opt = TARGET_TYPE_OPTIONS.find((o) => o.value === value)
          return opt?.label || value || '-'
        },
      },
      {
        title: '目标ID',
        dataIndex: 'target_id',
        width: 100,
        render: (value: number) => value ?? '-',
      },
    ],
    [],
  )

  const expandedRowRender = useCallback((record: AuditLogItem) => {
    const hasOldValue = record.old_value && record.old_value !== 'null'
    const hasNewValue = record.new_value && record.new_value !== 'null'

    if (!hasOldValue && !hasNewValue) return null

    return (
      <div style={{ padding: '8px 16px' }}>
        {hasOldValue && (
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: '#ff4d4f' }}>旧值 (old_value):</strong>
            <pre
              style={{
                maxHeight: 200,
                overflow: 'auto',
                background: isDark ? '#2a2a2a' : '#f5f5f5',
                padding: 8,
                marginTop: 4,
                fontSize: 12,
              }}
            >
              {formatJson(record.old_value)}
            </pre>
          </div>
        )}
        {hasNewValue && (
          <div>
            <strong style={{ color: '#52c41a' }}>新值 (new_value):</strong>
            <pre
              style={{
                maxHeight: 200,
                overflow: 'auto',
                background: isDark ? '#2a2a2a' : '#f5f5f5',
                padding: 8,
                marginTop: 4,
                fontSize: 12,
              }}
            >
              {formatJson(record.new_value)}
            </pre>
          </div>
        )}
      </div>
    )
  }, [isDark])

  const handleExportCSV = useCallback(() => {
    if (rows.length === 0) {
      message.warning('没有可导出的数据')
      return
    }
    const headers = [
      'ID',
      '创建时间',
      '操作人',
      '操作',
      '目标类型',
      '目标ID',
      '旧值',
      '新值',
    ]
    const lines = rows.map((row) => [
      row.id,
      row.created_at,
      row.operator_name ?? '',
      row.action ?? '',
      row.target_type ?? '',
      row.target_id ?? '',
      (row.old_value && row.old_value !== 'null') ? row.old_value : '',
      (row.new_value && row.new_value !== 'null') ? row.new_value : '',
    ])
    const csv = [headers, ...lines]
      .map((line) =>
        line
          .map((cell) => {
            const value = String(cell ?? '').replace(/"/g, '""')
            if (value.includes(',') || value.includes('\n') || value.includes('"')) {
              return `"${value}"`
            }
            return value
          })
          .join(','),
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
    message.success('导出成功')
  }, [rows, message])

  return (
    <div>
      <h2>审计日志</h2>

      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="操作人名称"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            onSearch={(v) => {
              // Immediate search: clear debounce and set directly
              if (debounceRef.current) clearTimeout(debounceRef.current)
              setDebouncedOperatorName(v)
              setPage(1)
            }}
            style={{ width: 180 }}
            allowClear
          />
          <Select
            placeholder="操作类型"
            value={action}
            onChange={(v) => {
              setAction(v)
              setPage(1)
            }}
            style={{ width: 120 }}
            options={ACTION_OPTIONS}
          />
          <Select
            placeholder="目标类型"
            value={targetType}
            onChange={(v) => {
              setTargetType(v)
              setPage(1)
            }}
            style={{ width: 140 }}
            options={TARGET_TYPE_OPTIONS}
          />
          <DatePicker.RangePicker
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([
                  dates[0].format('YYYY-MM-DD'),
                  dates[1].format('YYYY-MM-DD'),
                ])
              } else {
                setDateRange(null)
              }
              setPage(1)
            }}
            style={{ width: 250 }}
            placeholder={['开始日期', '结束日期']}
          />
          <Button onClick={handleExportCSV}>导出 CSV</Button>
        </Space>
      </div>

      <Table<AuditLogItem>
        size="middle"
        scroll={{ x: 'max-content' }}
        loading={isLoading}
        dataSource={rows}
        rowKey="id"
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showTotal: (t) => `共 ${t} 条记录`,
          onChange: setPage,
        }}
        columns={columns}
        expandable={{
          expandedRowRender,
          rowExpandable: (record) =>
            (record.old_value != null && record.old_value !== 'null') ||
            (record.new_value != null && record.new_value !== 'null'),
        }}
        locale={{
          emptyText: (
            <EmptyState description="暂无审计日志" />
          ),
        }}
      />
    </div>
  )
}
