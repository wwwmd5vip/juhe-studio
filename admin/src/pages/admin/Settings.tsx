import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card,
  Row,
  Col,
  Switch,
  Input,
  InputNumber,
  Button,
  Typography,
  Table,
  Space,
  Tag,
  Modal,
  Popconfirm,
  message,
  Spin,
  Collapse,
  Form,
  Select,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  MailOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { client } from '../../api/client'
import {
  getSettingsCategorized as fetchSettingsCategorized,
  upsertSetting as apiUpsertSetting,
  deleteSetting as apiDeleteSetting,
  testEmail as apiTestEmail,
} from '../../api/setting'

const { Title } = Typography

// ─── Types ───────────────────────────────────────────────────────────────────

interface Setting {
  id: number
  key: string
  value: string
  type: string
  category: string
  description: string
  created_at?: string
  updated_at?: string
}

interface SettingForm {
  key: string
  value: string
  type: string
  category: string
  description: string
}

const TYPE_OPTIONS = [
  { value: 'string', label: 'string' },
  { value: 'json', label: 'json' },
  { value: 'bool', label: 'bool' },
  { value: 'number', label: 'number' },
]

const TYPE_COLORS: Record<string, string> = {
  string: 'blue',
  json: 'purple',
  bool: 'orange',
  number: 'green',
}

// ─── API helpers ──────────────────────────────────────────────────────────────

type ApiRes = Record<string, any>

async function getSettingsCategorized() {
  const res = await fetchSettingsCategorized()
  if (res.code !== 0) throw new Error(res.message || '加载设置失败')
  return res.data as Record<string, Setting[]>
}

async function upsertSetting(
  key: string,
  value: string,
  type: string,
  category: string,
  description: string,
) {
  const res = await apiUpsertSetting({ key, value, type, category, description })
  if (res.code !== 0) throw new Error(res.message || '保存失败')
  return res.data
}

async function deleteSettingByKey(key: string) {
  const res = await apiDeleteSetting(key)
  if (res.code !== 0) throw new Error(res.message || '删除失败')
  return res.data
}

async function testEmail(email: string) {
  const res = await apiTestEmail(email)
  if (res.code !== 0) throw new Error(res.message || '测试发送失败')
  return res.data
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findSetting(settings: Setting[], key: string): Setting | undefined {
  return settings.find((s) => s.key === key)
}

function settingValue(settings: Setting[], key: string, fallback: string): string {
  const s = findSetting(settings, key)
  return s ? s.value : fallback
}

// ─── Card: auth (用户注册) ────────────────────────────────────────────────────

function AuthCard({
  settings,
  onSave,
  saving,
}: {
  settings: Setting[]
  onSave: (fields: { key: string; value: string; type: string; description: string }[]) => void
  saving: boolean
}) {
  const [registrationEnabled, setRegistrationEnabled] = useState(
    () => findSetting(settings, 'registration_enabled')?.value === 'true',
  )
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(
    () => findSetting(settings, 'email_verification_required')?.value === 'true',
  )
  const [passwordMinLength, setPasswordMinLength] = useState(() => {
    const s = findSetting(settings, 'password_min_length')
    return s ? Number(s.value) : 8
  })

  const handleSave = () => {
    onSave([
      {
        key: 'registration_enabled',
        value: String(registrationEnabled),
        type: 'bool',
        description: '是否允许用户自行注册',
      },
      {
        key: 'email_verification_required',
        value: String(emailVerificationRequired),
        type: 'bool',
        description: '注册是否需要邮箱验证',
      },
      {
        key: 'password_min_length',
        value: String(passwordMinLength),
        type: 'number',
        description: '用户密码最小长度',
      },
    ])
  }

  return (
    <Card
      title="用户注册"
      extra={
        <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space align="center">
            <span>允许注册：</span>
            <Switch
              checked={registrationEnabled}
              onChange={setRegistrationEnabled}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>
        </Col>
        <Col span={24}>
          <Space align="center">
            <span>邮箱验证：</span>
            <Switch
              checked={emailVerificationRequired}
              onChange={setEmailVerificationRequired}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>
        </Col>
        <Col span={24}>
          <Space align="center">
            <span>密码最小长度：</span>
            <InputNumber
              min={6}
              max={64}
              value={passwordMinLength}
              onChange={(v) => setPasswordMinLength(v ?? 8)}
              style={{ width: 100 }}
            />
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

// ─── Card: email (邮件服务) ────────────────────────────────────────────────────

function EmailCard({
  settings,
  onSave,
  saving,
}: {
  settings: Setting[]
  onSave: (fields: { key: string; value: string; type: string; description: string }[]) => void
  saving: boolean
}) {
  const [smtpHost, setSmtpHost] = useState(() => settingValue(settings, 'smtp_host', ''))
  const [smtpPort, setSmtpPort] = useState(() =>
    Number(settingValue(settings, 'smtp_port', '587')),
  )
  const [smtpUsername, setSmtpUsername] = useState(() =>
    settingValue(settings, 'smtp_username', ''),
  )
  const [smtpPassword, setSmtpPassword] = useState('')
  const passwordChangedRef = useRef(false)
  const [smtpFrom, setSmtpFrom] = useState(() => settingValue(settings, 'smtp_from', ''))

  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testEmailAddr, setTestEmailAddr] = useState('')
  const [testSending, setTestSending] = useState(false)

  const handleSave = () => {
    const fields: { key: string; value: string; type: string; description: string }[] = [
      { key: 'smtp_host', value: smtpHost, type: 'string', description: 'SMTP 服务器地址' },
      { key: 'smtp_port', value: String(smtpPort), type: 'number', description: 'SMTP 端口' },
      { key: 'smtp_username', value: smtpUsername, type: 'string', description: 'SMTP 用户名' },
      { key: 'smtp_from', value: smtpFrom, type: 'string', description: '发件人地址' },
    ]
    if (passwordChangedRef.current && smtpPassword) {
      fields.push({ key: 'smtp_password', value: smtpPassword, type: 'string', description: 'SMTP 密码' })
    }
    onSave(fields)
  }

  const handleTestEmail = async () => {
    if (!testEmailAddr.trim()) {
      message.warning('请输入测试邮箱地址')
      return
    }
    setTestSending(true)
    try {
      await testEmail(testEmailAddr.trim())
      message.success('测试邮件发送成功')
      setTestModalOpen(false)
      setTestEmailAddr('')
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '测试发送失败')
    } finally {
      setTestSending(false)
    }
  }

  return (
    <>
      <Card
        title="邮件服务"
        extra={
          <Space>
            <Button size="small" icon={<MailOutlined />} onClick={() => setTestModalOpen(true)}>
              测试发送
            </Button>
            <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              保存
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Form.Item label="SMTP 主机">
              <Input
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.example.com"
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="SMTP 端口">
              <Select
                value={smtpPort}
                onChange={(v) => setSmtpPort(v ?? 587)}
                style={{ width: '100%' }}
                options={[
                  { value: 587, label: '587 (STARTTLS，推荐)' },
                  { value: 465, label: '465 (SSL)' },
                  { value: 25, label: '25 (明文)' },
                  { value: 2525, label: '2525 (备用)' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="SMTP 用户名">
              <Input
                value={smtpUsername}
                onChange={(e) => setSmtpUsername(e.target.value)}
                placeholder="user@example.com"
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="SMTP 密码">
              <Input.Password
                value={smtpPassword}
                onChange={(e) => { setSmtpPassword(e.target.value); passwordChangedRef.current = true }}
                placeholder="留空则不修改现有密码"
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="发件人地址">
              <Input
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                placeholder="noreply@juhe.studio"
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Modal
        title="测试邮件发送"
        open={testModalOpen}
        onCancel={() => {
          setTestModalOpen(false)
          setTestEmailAddr('')
        }}
        onOk={handleTestEmail}
        confirmLoading={testSending}
        okText="发送"
        cancelText="取消"
      >
        <div style={{ marginBottom: 8 }}>请输入接收测试邮件的邮箱地址：</div>
        <Input
          value={testEmailAddr}
          onChange={(e) => setTestEmailAddr(e.target.value)}
          placeholder="test@example.com"
          type="email"
        />
      </Modal>
    </>
  )
}

// ─── Card: security (安全设置) ─────────────────────────────────────────────────

function parseWords(raw: string): string[] {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function SecurityCard({
  settings,
  onSave,
  saving,
}: {
  settings: Setting[]
  onSave: (fields: { key: string; value: string; type: string; description: string }[]) => void
  saving: boolean
}) {
  const [sensitiveWordsEnabled, setSensitiveWordsEnabled] = useState(
    () => findSetting(settings, 'sensitive_words_enabled')?.value === 'true',
  )

  const [wordsText, setWordsText] = useState(() => {
    const s = findSetting(settings, 'sensitive_words_list')
    return s ? parseWords(s.value).join('\n') : ''
  })

  const getWordCount = () => {
    return wordsText
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0).length
  }

  const handleSave = () => {
    const words = wordsText
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
    onSave([
      {
        key: 'sensitive_words_enabled',
        value: String(sensitiveWordsEnabled),
        type: 'bool',
        description: '是否启用敏感词过滤',
      },
      {
        key: 'sensitive_words_list',
        value: JSON.stringify(words),
        type: 'json',
        description: '敏感词列表',
      },
    ])
  }

  return (
    <Card
      title="安全设置"
      extra={
        <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space align="center">
            <span>敏感词过滤：</span>
            <Switch
              checked={sensitiveWordsEnabled}
              onChange={setSensitiveWordsEnabled}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>
        </Col>
        <Col span={24}>
          <div style={{ marginBottom: 4 }}>
            敏感词列表（每行一个词，共 {getWordCount()} 个）
          </div>
          <Input.TextArea
            value={wordsText}
            onChange={(e) => setWordsText(e.target.value)}
            placeholder={"每行输入一个敏感词\n例如：\n赌博\n毒品\n枪支"}
            rows={10}
            maxLength={50000}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            每行一个敏感词，可批量粘贴。保存后自动去空行和首尾空格。
          </div>
        </Col>
      </Row>
    </Card>
  )
}

// ─── Card: quota (配额限制) ────────────────────────────────────────────────────

function QuotaCard({
  settings,
  onSave,
  saving,
}: {
  settings: Setting[]
  onSave: (fields: { key: string; value: string; type: string; description: string }[]) => void
  saving: boolean
}) {
  const [quotaLowThreshold, setQuotaLowThreshold] = useState(() => {
    const s = findSetting(settings, 'QUOTA_LOW_THRESHOLD')
    return s ? Number(s.value) : 100
  })
  const [playgroundFreeTrials, setPlaygroundFreeTrials] = useState(() => {
    const s = findSetting(settings, 'PLAYGROUND_FREE_TRIALS')
    return s ? Number(s.value) : 10
  })

  const handleSave = () => {
    onSave([
      {
        key: 'QUOTA_LOW_THRESHOLD',
        value: String(quotaLowThreshold),
        type: 'number',
        description: '额度低阈值提醒（分）',
      },
      {
        key: 'PLAYGROUND_FREE_TRIALS',
        value: String(playgroundFreeTrials),
        type: 'number',
        description: 'Playground 免费试用次数',
      },
    ])
  }

  return (
    <Card
      title="配额限制"
      extra={
        <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space align="center">
            <span>额度低阈值：</span>
            <InputNumber
              min={0}
              value={quotaLowThreshold}
              onChange={(v) => setQuotaLowThreshold(v ?? 100)}
              suffix="分"
              style={{ width: 160 }}
            />
          </Space>
        </Col>
        <Col span={24}>
          <Space align="center">
            <span>免费试用次数：</span>
            <InputNumber
              min={0}
              value={playgroundFreeTrials}
              onChange={(v) => setPlaygroundFreeTrials(v ?? 10)}
              suffix="次"
              style={{ width: 160 }}
            />
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

// ─── Card: rate (速率与安全) ────────────────────────────────────────────────────

function RateCard({
  settings,
  onSave,
  saving,
}: {
  settings: Setting[]
  onSave: (fields: { key: string; value: string; type: string; description: string }[]) => void
  saving: boolean
}) {
  const [rateLimitRpm, setRateLimitRpm] = useState(() => {
    const s = findSetting(settings, 'rate_limit_rpm')
    return s ? Number(s.value) : 60
  })
  const [logRetentionDays, setLogRetentionDays] = useState(() => {
    const s = findSetting(settings, 'log_retention_days')
    return s ? Number(s.value) : 90
  })
  const [maxRequestBodyMb, setMaxRequestBodyMb] = useState(() => {
    const s = findSetting(settings, 'max_request_body_mb')
    return s ? Number(s.value) : 10
  })

  const handleSave = () => {
    onSave([
      {
        key: 'rate_limit_rpm',
        value: String(rateLimitRpm),
        type: 'number',
        description: '全局速率限制（次/分钟）',
      },
      {
        key: 'log_retention_days',
        value: String(logRetentionDays),
        type: 'number',
        description: '消费日志保留天数',
      },
      {
        key: 'max_request_body_mb',
        value: String(maxRequestBodyMb),
        type: 'number',
        description: '请求体最大大小（MB）',
      },
    ])
  }

  return (
    <Card
      title="速率与安全"
      extra={
        <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space align="center">
            <span>速率限制：</span>
            <InputNumber
              min={1}
              max={10000}
              value={rateLimitRpm}
              onChange={(v) => setRateLimitRpm(v ?? 60)}
              suffix="次/分钟"
              style={{ width: 160 }}
            />
          </Space>
        </Col>
        <Col span={24}>
          <Space align="center">
            <span>日志保留天数：</span>
            <InputNumber
              min={1}
              max={3650}
              value={logRetentionDays}
              onChange={(v) => setLogRetentionDays(v ?? 90)}
              suffix="天"
              style={{ width: 160 }}
            />
          </Space>
        </Col>
        <Col span={24}>
          <Space align="center">
            <span>请求体最大：</span>
            <InputNumber
              min={1}
              max={1024}
              value={maxRequestBodyMb}
              onChange={(v) => setMaxRequestBodyMb(v ?? 10)}
              suffix="MB"
              style={{ width: 160 }}
            />
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

// ─── Card: model (默认模型) ────────────────────────────────────────────────────

function ModelCard({
  settings,
  onSave,
  saving,
}: {
  settings: Setting[]
  onSave: (fields: { key: string; value: string; type: string; description: string }[]) => void
  saving: boolean
}) {
  const [visionModel, setVisionModel] = useState(() =>
    settingValue(settings, 'DEFAULT_VISION_MODEL', ''),
  )
  const [llmModel, setLlmModel] = useState(() =>
    settingValue(settings, 'DEFAULT_LLM_MODEL', ''),
  )

  // 模型下拉选项
  const [visionModels, setVisionModels] = useState<{ value: string; label: string }[]>([])
  const [llmModels, setLlmModels] = useState<{ value: string; label: string }[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const fetchModels = async () => {
      setLoadingModels(true)
      try {
        const res: ApiRes = await client.get('/models?page_size=200', { signal: controller.signal })
        if (res.code !== 0) return
        const all: any[] = (res.data as any)?.data || []
        if (cancelled) return
        const visionOpts: { value: string; label: string }[] = []
        const llmOpts: { value: string; label: string }[] = []
        for (const m of all) {
          if (!m.has_pricing) continue
          const label = `${m.model_name}${m.display_name ? ` (${m.display_name})` : ''}`
          const opt = { value: m.model_name, label }
          if (m.type === 'image' || (m.capabilities && m.capabilities.includes('vision'))) {
            visionOpts.push(opt)
          }
          if (m.type === 'llm' || m.type === '') {
            llmOpts.push(opt)
          }
        }
        if (!cancelled) {
          setVisionModels(visionOpts)
          setLlmModels(llmOpts)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // ignore fetch errors, user can still type manually
      } finally {
        if (!cancelled) setLoadingModels(false)
      }
    }
    fetchModels()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const handleSave = () => {
    onSave([
      {
        key: 'DEFAULT_VISION_MODEL',
        value: visionModel,
        type: 'string',
        description: '默认图像识别模型',
      },
      {
        key: 'DEFAULT_LLM_MODEL',
        value: llmModel,
        type: 'string',
        description: '默认 LLM 文本模型',
      },
    ])
  }

  return (
    <Card
      title="默认模型"
      extra={
        <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div style={{ marginBottom: 4 }}>默认图像识别模型</div>
          <Select
            showSearch
            value={visionModel || undefined}
            onChange={(v) => setVisionModel(v || '')}
            placeholder="选择或输入模型名"
            allowClear
            loading={loadingModels}
            style={{ width: '100%' }}
            options={visionModels}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            设置后，桌面端工作流中的图像识别步骤将使用此模型。留空则使用本地配置。
          </div>
        </Col>
        <Col span={24}>
          <div style={{ marginBottom: 4 }}>默认 LLM 文本模型</div>
          <Select
            showSearch
            value={llmModel || undefined}
            onChange={(v) => setLlmModel(v || '')}
            placeholder="选择或输入模型名"
            allowClear
            loading={loadingModels}
            style={{ width: '100%' }}
            options={llmModels}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            设置后，桌面端工作流中的文本对话步骤将使用此模型。留空则使用本地配置。
          </div>
        </Col>
      </Row>
    </Card>
  )
}

// ─── Card: system (系统调度) ────────────────────────────────────────────────────

function SystemCard({
  settings,
  onSave,
  saving,
}: {
  settings: Setting[]
  onSave: (fields: { key: string; value: string; type: string; description: string }[]) => void
  saving: boolean
}) {
  const [schedulerEnabled, setSchedulerEnabled] = useState(
    () => findSetting(settings, 'scheduler_enabled')?.value === 'true',
  )
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(
    () => findSetting(settings, 'health_check_enabled')?.value === 'true',
  )

  const handleSave = () => {
    onSave([
      {
        key: 'scheduler_enabled',
        value: String(schedulerEnabled),
        type: 'bool',
        description: '是否启用定时任务',
      },
      {
        key: 'health_check_enabled',
        value: String(healthCheckEnabled),
        type: 'bool',
        description: '是否启用渠道健康检查',
      },
    ])
  }

  return (
    <Card
      title="系统调度"
      extra={
        <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space align="center">
            <span>定时任务：</span>
            <Switch
              checked={schedulerEnabled}
              onChange={setSchedulerEnabled}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            定时任务（日账单聚合、订阅续费、日志清理）需重启服务后生效
          </div>
        </Col>
        <Col span={24}>
          <Space align="center">
            <span>健康检查：</span>
            <Switch
              checked={healthCheckEnabled}
              onChange={setHealthCheckEnabled}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            渠道健康检查需重启服务后生效
          </div>
        </Col>
      </Row>
    </Card>
  )
}

// ─── Card: network (访问与通知) ────────────────────────────────────────────────

function NetworkCard({
  settings,
  onSave,
  saving,
}: {
  settings: Setting[]
  onSave: (fields: { key: string; value: string; type: string; description: string }[]) => void
  saving: boolean
}) {
  const [corsOrigins, setCorsOrigins] = useState(() =>
    settingValue(settings, 'cors_allowed_origins', '*'),
  )
  const [wsEnabled, setWsEnabled] = useState(
    () => findSetting(settings, 'ws_notifications_enabled')?.value === 'true',
  )

  const handleSave = () => {
    onSave([
      {
        key: 'cors_allowed_origins',
        value: corsOrigins,
        type: 'string',
        description: 'CORS 允许的来源（* 表示全部，多个用逗号分隔）',
      },
      {
        key: 'ws_notifications_enabled',
        value: String(wsEnabled),
        type: 'bool',
        description: '是否启用 WebSocket 实时推送',
      },
    ])
  }

  return (
    <Card
      title="访问与通知"
      extra={
        <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div style={{ marginBottom: 4 }}>CORS 允许来源</div>
          <Input
            value={corsOrigins}
            onChange={(e) => setCorsOrigins(e.target.value)}
            placeholder="* 或 https://example.com,https://app.example.com"
          />
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            多个地址用逗号分隔，* 表示允许所有来源。修改后需重启服务生效。
          </div>
        </Col>
        <Col span={24}>
          <Space align="center">
            <span>WebSocket 实时推送：</span>
            <Switch
              checked={wsEnabled}
              onChange={setWsEnabled}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

// ─── Main: Settings Page ──────────────────────────────────────────────────────

const KNOWN_CATEGORIES = ['auth', 'email', 'security', 'quota', 'rate', 'model', 'system', 'network']

export default function Settings() {
  const [categorized, setCategorized] = useState<Record<string, Setting[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingCategory, setSavingCategory] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)

  // Custom settings modal
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [editingCustomKey, setEditingCustomKey] = useState<string | null>(null)
  const [customForm] = Form.useForm<SettingForm>()
  const customInitialValuesRef = useRef('')
  const customCloseForceRef = useRef(false)

  const customDirty = useCallback(() => {
    return JSON.stringify(customForm.getFieldsValue()) !== customInitialValuesRef.current
  }, [customForm])

  // Warn on tab close / refresh when custom form has unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasChanges = JSON.stringify(customForm.getFieldsValue()) !== customInitialValuesRef.current
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [customForm])

  // Delete loading state
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  // Prevent double-load in React 18+ strict mode
  const mountedRef = useRef(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSettingsCategorized()
      setCategorized(data)
      setResetKey((k) => k + 1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    loadSettings()
  }, [loadSettings])

  const handleSaveCategory = useCallback(
    async (
      category: string,
      fields: { key: string; value: string; type: string; description: string }[],
    ) => {
      setSavingCategory(category)
      try {
        for (const f of fields) {
          await upsertSetting(f.key, f.value, f.type, category, f.description)
        }
        message.success('保存成功')
        await loadSettings()
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : '保存失败')
      } finally {
        setSavingCategory(null)
      }
    },
    [loadSettings],
  )

  const handleDeleteSetting = useCallback(
    async (key: string) => {
      setDeletingKey(key)
      try {
        await deleteSettingByKey(key)
        message.success('删除成功')
        await loadSettings()
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : '删除失败')
      } finally {
        setDeletingKey(null)
      }
    },
    [loadSettings],
  )

  const handleOpenCustomModal = (record?: Setting) => {
    if (record) {
      setEditingCustomKey(record.key)
      customForm.setFieldsValue({
        key: record.key,
        value: record.value,
        type: record.type,
        category: record.category || '',
        description: record.description || '',
      })
    } else {
      setEditingCustomKey(null)
      customForm.resetFields()
    }
    setTimeout(() => { customInitialValuesRef.current = JSON.stringify(customForm.getFieldsValue()) }, 0)
    setCustomModalOpen(true)
  }

  const handleCustomSubmit = async (values: SettingForm) => {
    try {
      await upsertSetting(
        values.key,
        values.value,
        values.type,
        values.category || '',
        values.description || '',
      )
      message.success(editingCustomKey ? '更新成功' : '创建成功')
      customCloseForceRef.current = true
      setCustomModalOpen(false)
      setEditingCustomKey(null)
      customForm.resetFields()
      await loadSettings()
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存失败')
    }
  }

  // Gather "other" settings: any category that isn't one of the predefined ones
  const otherSettings: Setting[] = []
  for (const [cat, items] of Object.entries(categorized)) {
    if (!KNOWN_CATEGORIES.includes(cat)) {
      otherSettings.push(...items)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading && Object.keys(categorized).length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (error && Object.keys(categorized).length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <div style={{ color: '#ff4d4f', fontSize: 16, marginBottom: 16 }}>{error}</div>
        <Button type="primary" icon={<ReloadOutlined />} onClick={loadSettings}>
          重新加载
        </Button>
      </div>
    )
  }

  const otherColumns = [
    { title: 'Key', dataIndex: 'key', ellipsis: true },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={TYPE_COLORS[type] || 'default'}>{type}</Tag>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: true,
      render: (d: string) => d || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Setting) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenCustomModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除设置 "${record.key}" 吗？`}
            onConfirm={() => handleDeleteSetting(record.key)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deletingKey === record.key}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          系统设置
        </Title>
        <Button icon={<ReloadOutlined />} onClick={loadSettings} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <AuthCard
            key={`auth-${resetKey}`}
            settings={categorized.auth || []}
            onSave={(fields) => handleSaveCategory('auth', fields)}
            saving={savingCategory === 'auth'}
          />
        </Col>
        <Col xs={24} md={12}>
          <EmailCard
            key={`email-${resetKey}`}
            settings={categorized.email || []}
            onSave={(fields) => handleSaveCategory('email', fields)}
            saving={savingCategory === 'email'}
          />
        </Col>
        <Col xs={24} md={12}>
          <SecurityCard
            key={`security-${resetKey}`}
            settings={categorized.security || []}
            onSave={(fields) => handleSaveCategory('security', fields)}
            saving={savingCategory === 'security'}
          />
        </Col>
        <Col xs={24} md={12}>
          <QuotaCard
            key={`quota-${resetKey}`}
            settings={categorized.quota || []}
            onSave={(fields) => handleSaveCategory('quota', fields)}
            saving={savingCategory === 'quota'}
          />
        </Col>
        <Col xs={24} md={12}>
          <RateCard
            key={`rate-${resetKey}`}
            settings={categorized.rate || []}
            onSave={(fields) => handleSaveCategory('rate', fields)}
            saving={savingCategory === 'rate'}
          />
        </Col>
        <Col xs={24} md={12}>
          <ModelCard
            key={`model-${resetKey}`}
            settings={categorized.model || []}
            onSave={(fields) => handleSaveCategory('model', fields)}
            saving={savingCategory === 'model'}
          />
        </Col>
        <Col xs={24} md={12}>
          <SystemCard
            key={`system-${resetKey}`}
            settings={categorized.system || []}
            onSave={(fields) => handleSaveCategory('system', fields)}
            saving={savingCategory === 'system'}
          />
        </Col>
        <Col xs={24} md={12}>
          <NetworkCard
            key={`network-${resetKey}`}
            settings={categorized.network || []}
            onSave={(fields) => handleSaveCategory('network', fields)}
            saving={savingCategory === 'network'}
          />
        </Col>
      </Row>

      <Collapse
        style={{ marginTop: 24 }}
        items={[
          {
            key: 'other',
            label: `自定义设置${otherSettings.length > 0 ? ` (${otherSettings.length})` : ''}`,
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenCustomModal()}
                  >
                    新增设置
                  </Button>
                </div>
                <Table
                  dataSource={otherSettings}
                  rowKey="id"
                  columns={otherColumns}
                  size="middle"
                  locale={{ emptyText: '暂无自定义设置' }}
                  pagination={false}
                />
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={editingCustomKey ? '编辑设置' : '新增设置'}
        open={customModalOpen}
        onCancel={() => {
          if (!customCloseForceRef.current && customDirty()) {
            Modal.confirm({
              title: '确认关闭',
              content: '有未保存的修改，确定要关闭吗？',
              okText: '确定',
              cancelText: '取消',
              onOk: () => {
                customCloseForceRef.current = false
                setCustomModalOpen(false)
                setEditingCustomKey(null)
                customForm.resetFields()
              },
            })
          } else {
            customCloseForceRef.current = false
            setCustomModalOpen(false)
            setEditingCustomKey(null)
            customForm.resetFields()
          }
        }}
        onOk={() => customForm.submit()}
        width={560}
      >
        <Form
          form={customForm}
          layout="vertical"
          onFinish={handleCustomSubmit}
          initialValues={{ type: 'string', category: '', key: '', value: '', description: '' }}
        >
          <Form.Item label="Key" name="key" rules={[{ required: true, message: '请输入 Key' }]}>
            <Input placeholder="设置键名" disabled={!!editingCustomKey} />
          </Form.Item>

          <Form.Item label="Type" name="type" rules={[{ required: true, message: '请选择 Type' }]}>
            <Select options={TYPE_OPTIONS} placeholder="选择类型" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.type !== cur.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type') || 'string'
              return (
                <Form.Item
                  label="Value"
                  name="value"
                  rules={[{ required: true, message: '请输入 Value' }]}
                >
                  {type === 'bool' ? (
                    <Select
                      placeholder="选择值"
                      options={[
                        { value: 'true', label: 'true' },
                        { value: 'false', label: 'false' },
                      ]}
                    />
                  ) : type === 'number' ? (
                    <Input placeholder="输入数值" style={{ width: '100%' }} />
                  ) : (
                    <Input.TextArea rows={4} placeholder="设置值" />
                  )}
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item label="Category" name="category">
            <Input placeholder="分类标识（可选）" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="设置描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
