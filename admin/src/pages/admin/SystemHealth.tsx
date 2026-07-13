import { useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Alert, Typography, Button, Modal, Form, Switch, InputNumber, Input, App } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FieldTimeOutlined,
  CodeOutlined,
  NodeIndexOutlined,
  DatabaseOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSystemStatus, getSchedulerStatus, type SchedulerJob } from '../../api/system'
import { listSettings, bulkUpdateSettings } from '../../api/setting'

const HEALTH_SETTING_KEYS = [
  'HEALTH_CHECK_ENABLED',
  'HEALTH_CHECK_INTERVAL',
  'HEALTH_CHECK_TIMEOUT',
  'HEALTH_CHECK_THRESHOLD',
  'SCHEDULER_ENABLED',
  'LOG_RETENTION_DAYS',
]

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  parts.push(`${minutes}分钟`)
  return parts.join('')
}

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
}

const schedulerColumns = [
  { title: '任务名称', dataIndex: 'name', key: 'name' },
  { title: '调度周期', dataIndex: 'schedule', key: 'schedule' },
  {
    title: '上次执行',
    dataIndex: 'last_run',
    key: 'last_run',
    render: (v: string | null) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
  },
  {
    title: '下次执行',
    dataIndex: 'next_run',
    key: 'next_run',
    render: (v: string | null) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
  },
  {
    title: '执行结果',
    dataIndex: 'last_result',
    key: 'last_result',
    render: (v: string) => {
      if (!v) return <Tag>未执行</Tag>
      if (v === 'success') return <Tag color="green">成功</Tag>
      return <Tag color="red">失败</Tag>
    },
  },
]

export default function SystemHealth() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm] = Form.useForm()

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['system', 'status'],
    queryFn: () => getSystemStatus(),
    staleTime: 60_000,
  })

  const { data: schedData, isLoading: schedLoading } = useQuery({
    queryKey: ['system', 'scheduler'],
    queryFn: () => getSchedulerStatus(),
    staleTime: 60_000,
  })

  // Load current health settings
  const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => listSettings(1, 100),
  })

  const bulkMutation = useMutation({
    mutationFn: bulkUpdateSettings,
    onSuccess: (res) => {
      if (res.code !== 0) {
        message.error(res.message || '保存失败')
        return
      }
      message.success('设置已保存')
      setSettingsOpen(false)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (error: Error) => {
      message.error(error.message)
    },
  })

  const apiOk = status?.status === 'ok'
  const dbOk = status?.db_status === 'ok'
  const jobs: SchedulerJob[] = schedData?.data?.jobs ?? []

  // Build settings map from loaded data
  const settingsMap: Record<string, string> = {}
  const allSettings = settingsData?.data?.data ?? []
  for (const s of allSettings) {
    if (HEALTH_SETTING_KEYS.includes(s.key)) {
      settingsMap[s.key] = s.value
    }
  }

  const handleOpenSettings = () => {
    const initial: Record<string, unknown> = {}
    for (const key of HEALTH_SETTING_KEYS) {
      const v = settingsMap[key]
      if (key === 'HEALTH_CHECK_ENABLED' || key === 'SCHEDULER_ENABLED') {
        initial[key] = v === 'true'
      } else if (key === 'HEALTH_CHECK_TIMEOUT' || key === 'HEALTH_CHECK_THRESHOLD' || key === 'LOG_RETENTION_DAYS') {
        initial[key] = v ? Number(v) : undefined
      } else {
        initial[key] = v || ''
      }
    }
    settingsForm.setFieldsValue(initial)
    setSettingsOpen(true)
  }

  const handleSaveSettings = () => {
    settingsForm.validateFields().then((values: Record<string, unknown>) => {
      const items = HEALTH_SETTING_KEYS.map((key) => {
        const v = values[key]
        let strVal: string
        if (typeof v === 'boolean') {
          strVal = v ? 'true' : 'false'
        } else if (v === undefined || v === null) {
          strVal = ''
        } else {
          strVal = String(v)
        }
        return { key, value: strVal }
      })
      bulkMutation.mutate(items)
    }).catch(() => {
      // form validation failed — Ant Design shows inline errors, no additional action needed
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>系统健康</h2>
        <Button icon={<SettingOutlined />} onClick={handleOpenSettings} disabled={isLoadingSettings}>
          编辑阈值
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card style={cardStyle} loading={statusLoading}>
            <Statistic
              title="API 状态"
              value={apiOk ? '正常' : '异常'}
              valueStyle={{ color: apiOk ? '#52c41a' : '#ff4d4f' }}
              prefix={apiOk ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              suffix={
                status ? (
                  <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                    v{status.version}
                  </Typography.Text>
                ) : undefined
              }
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card style={cardStyle} loading={statusLoading}>
            <Statistic
              title="数据库状态"
              value={dbOk ? '正常' : '异常'}
              valueStyle={{ color: dbOk ? '#52c41a' : '#ff4d4f' }}
              prefix={dbOk ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle} loading={statusLoading}>
            <Statistic
              title="运行时间"
              value={status ? formatUptime(status.uptime_seconds) : '-'}
              prefix={<FieldTimeOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle} loading={statusLoading}>
            <Statistic
              title="Go 版本"
              value={status?.go_version ?? '-'}
              prefix={<CodeOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle} loading={statusLoading}>
            <Statistic
              title="协程数"
              value={status?.goroutine_count ?? '-'}
              prefix={<NodeIndexOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle} loading={statusLoading}>
            <Statistic
              title="内存 (MB)"
              value={status?.memory_mb != null ? status.memory_mb.toFixed(1) : '-'}
              prefix={<DatabaseOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="调度器任务" style={{ ...cardStyle, marginTop: 16 }} loading={schedLoading}>
        {jobs.length === 0 ? (
          <Alert type="info" message="调度器未启用" showIcon />
        ) : (
          <Table
            dataSource={jobs}
            columns={schedulerColumns}
            rowKey="name"
            pagination={false}
            size="small"
          />
        )}
      </Card>

      {/* Health Check Settings Modal */}
      <Modal
        title="健康检查与系统阈值设置"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={handleSaveSettings}
        confirmLoading={bulkMutation.isPending}
        width={520}
      >
        <Alert
          type="warning"
          message="部分设置修改后需重启服务生效"
          style={{ marginBottom: 16 }}
          showIcon
        />
        <Form form={settingsForm} layout="vertical">
          <Form.Item
            label="健康检查开关"
            name="HEALTH_CHECK_ENABLED"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="健康检查频率 (Cron)"
            name="HEALTH_CHECK_INTERVAL"
            rules={[{ required: true, message: '请输入 cron 表达式' }]}
          >
            <Input placeholder="例如：0 */5 * * *" />
          </Form.Item>

          <Form.Item
            label="健康检查超时 (秒)"
            name="HEALTH_CHECK_TIMEOUT"
            rules={[{ required: true, message: '请输入超时时间' }]}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="连续失败阈值"
            name="HEALTH_CHECK_THRESHOLD"
            rules={[{ required: true, message: '请输入阈值' }]}
            help="连续失败达到此次数后自动下线渠道"
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="调度器开关"
            name="SCHEDULER_ENABLED"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="日志保留天数"
            name="LOG_RETENTION_DAYS"
            rules={[{ required: true, message: '请输入天数' }]}
          >
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
