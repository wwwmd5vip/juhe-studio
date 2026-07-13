import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Space,
  App,
  Popconfirm,
  Checkbox,
  Typography,
  Tag,
  Collapse,
  Tooltip,
  Popover,
  Row,
  Col,
  Card,
  Statistic,
  Segmented,
  Alert,
} from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import {
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  testChannel,
  testChannelFromConfig,
  previewModelsFromConfig,
  listTestLogs,
  getChannelLoadOverview,
  type Channel,
  type ChannelForm,
  type ChannelTestLog,
  type ChannelLoadItem,
} from '../../api/channel'
import { listModels } from '../../api/model'
import { getChannelColor, getChannelLabel, CHANNEL_COLORS } from '../../styles/channel-colors'
import EmptyState from '../../components/EmptyState'
import ModelMappingEditor from '../../components/ModelMappingEditor'
import ChannelLoadChart from '../../components/channels/ChannelLoadChart'
import ChannelTestModal from '../../components/channels/ChannelTestModal'
import CsvImportModal from '../../components/CsvImportModal'
import ConfirmPasswordModal from '../../components/ConfirmPasswordModal'
import { useThemeStore } from '../../stores/themeStore'

const CHANNEL_TYPES = [
  { value: 'openai', label: 'OpenAI (原生)' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'siliconflow', label: '硅基流动' },
  { value: 'volcengine', label: '火山引擎' },
  { value: 'zhipu', label: '智谱' },
  { value: 'qwen', label: '通义千问' },
  { value: 'moonshot', label: 'Moonshot/Kimi' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama (本地)' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'vertex', label: 'Vertex AI' },
  { value: 'bedrock', label: 'AWS Bedrock' },
  { value: 'jimeng', label: '即梦' },
  { value: 'kling', label: '可灵' },
  { value: 'coze', label: '扣子' },
  { value: 'mxapi', label: 'MXAPI' },
  { value: 'xai', label: 'xAI (Grok)' },
  { value: 'custom', label: '自定义' },
]

const CHANNEL_DEFAULT_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
  deepseek: 'https://api.deepseek.com',
  siliconflow: 'https://api.siliconflow.cn',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  moonshot: 'https://api.moonshot.cn',
  openrouter: 'https://openrouter.ai/api',
  ollama: 'http://localhost:11434',
  xai: 'https://api.x.ai',
  jimeng: 'https://visual.volcengineapi.com',
  mxapi: 'https://open.mxapi.org',
  coze: 'https://api.coze.cn',
  kling: 'https://dashscope.aliyuncs.com',
}

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

const defaultFormValues: ChannelForm = {
  type: 'openai-compatible',
  name: '',
  base_url: '',
  auth_type: 'api-key',
  keys: '',
  models: '',
  groups: '',
  weight: 1,
  priority: 0,
  timeout_seconds: 30,
  auto_ban: true,
}

const urlValidator = (_: unknown, value: string) => {
  if (!value || value.trim() === '') return Promise.resolve()
  if (value.startsWith('http://') || value.startsWith('https://')) return Promise.resolve()
  return Promise.reject(new Error('Base URL 必须以 http:// 或 https:// 开头'))
}

function formatJSON(value: Record<string, string> | undefined): string {
  if (!value || Object.keys(value).length === 0) return ''
  return JSON.stringify(value, null, 2)
}

function parseJSON(value: string): Record<string, string> | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = JSON.parse(trimmed)
  if (typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('必须是 JSON 对象')
  const result: Record<string, string> = {}
  for (const key of Object.keys(parsed)) result[key] = String(parsed[key])
  return result
}

const jsonValidator = (_: unknown, value: string) => {
  if (!value || value.trim() === '') return Promise.resolve()
  try { parseJSON(value); return Promise.resolve() }
  catch { return Promise.reject(new Error('不是有效的 JSON 对象')) }
}

function hashForm(v: unknown): string {
  return JSON.stringify(v, (_, val) =>
    val === undefined ? null : val
  )
}

/** 渠道类型彩色徽章 */
function ChannelTypeBadge({ type }: { type: string }) {
  const c = getChannelColor(type)
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      {getChannelLabel(type)}
    </span>
  )
}

export default function Channels() {
  const { modal, message } = App.useApp()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'load'>('list')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form] = Form.useForm<
    ChannelForm & { model_mapping_json?: string; status_code_mapping_json?: string }
  >()

  // Initial form snapshot for dirty detection
  const initialValuesRef = useRef('')

  // Confirm password modal
  const [confirmOpen, setConfirmOpen] = useState(false)
  const confirmActionRef = useRef<(() => void) | null>(null)
  const dirty = useCallback(() => {
    const current = hashForm(form.getFieldsValue())
    return current !== initialValuesRef.current
  }, [form])

  // Warn on tab close / refresh when form has unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const currentValues = form.getFieldsValue()
      const hasChanges = hashForm(currentValues) !== initialValuesRef.current
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [form])

  // ---- Inline model fetch state ----
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)

  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [modelTypes, setModelTypes] = useState<Record<string, string>>({})
  const [modelCaps, setModelCaps] = useState<Record<string, string[]>>({})
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [showFetchedList, setShowFetchedList] = useState(false)

  // ---- Connectivity test state ----
  const [testResult, setTestResult] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [importModalOpen, setImportModalOpen] = useState(false)
  // ----------------------------------

  const watchedModels: string = Form.useWatch('models', form) || ''
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['channels', page, keyword],
    queryFn: () => listChannels(page, 20, keyword),
  })

  const channels: Channel[] = data?.data?.data || []

  // Load overview
  const { data: loadData, isLoading: loadLoading } = useQuery({
    queryKey: ['channels', 'load-overview'],
    queryFn: getChannelLoadOverview,
    staleTime: 30_000,
    enabled: viewMode === 'load',
  })
  const loadChannels: ChannelLoadItem[] = loadData?.data?.channels ?? []

  const channelStats = useMemo(() => {
    if (!channels) return { total: 0, enabled: 0, autoBanned: 0, failing: 0 }
    return {
      total: channels.length,
      enabled: channels.filter((c) => c.status === 1).length,
      autoBanned: channels.filter((c) => c.auto_ban).length,
      failing: channels.filter((c) => (c.consecutive_failures || 0) >= 3).length,
    }
  }, [channels])

  const [testLoading, setTestLoading] = useState<Record<number, boolean>>({})

  // ---- Test log history state ----
  const [historyChannelId, setHistoryChannelId] = useState<number | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['channel-test-logs', historyChannelId, historyPage],
    queryFn: () => historyChannelId ? listTestLogs(historyChannelId, historyPage) : Promise.resolve(null),
    enabled: historyChannelId !== null,
  })
  const testLogs: ChannelTestLog[] = (historyData as any)?.data?.data ?? []
  const testLogsTotal = (historyData as any)?.data?.pagination?.total ?? 0

  // Available model names for Select dropdown
  const { data: allModelsData } = useQuery({
    queryKey: ['models-for-select'],
    queryFn: () => listModels(1, 200),
    staleTime: 60000,
  })
  const availableModelNames: string[] = Array.from(
    new Set((allModelsData?.data?.data ?? []).map((m) => m.model_name))
  ).sort()

  const createMutation = useMutation({
    mutationFn: createChannel,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '创建失败'); return }
      message.success('创建成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'load-overview'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'simple'] })
      queryClient.invalidateQueries({ queryKey: ['channels-for-sync'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<ChannelForm> }) =>
      updateChannel(id, values),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '更新失败'); return }
      message.success('更新成功')
      closeForceRef.current = true
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'load-overview'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'simple'] })
      queryClient.invalidateQueries({ queryKey: ['channels-for-sync'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteChannel,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '删除失败'); return }
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'load-overview'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'simple'] })
      queryClient.invalidateQueries({ queryKey: ['channels-for-sync'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const handleBatchDelete = async () => {
    setBatchDeleting(true)
    try {
      const keys = [...selectedRowKeys]
      const results = await Promise.allSettled(
        keys.map(async (key) => {
          const res = await deleteChannel(Number(key))
          if (res.code !== 0) throw new Error(res.message)
        })
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed === 0) {
        message.success(`成功删除 ${keys.length} 个渠道`)
      } else {
        message.warning(`删除完成：${keys.length - failed} 成功，${failed} 失败`)
      }
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'load-overview'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'simple'] })
      queryClient.invalidateQueries({ queryKey: ['channels-for-sync'] })
    } finally {
      setBatchDeleting(false)
    }
  }

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: number }) =>
      updateChannel(id, { status } as Partial<ChannelForm>),
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '操作失败'); return }
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'load-overview'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'simple'] })
      queryClient.invalidateQueries({ queryKey: ['channels-for-sync'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const testMutation = useMutation({
    mutationFn: testChannel,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '测试失败'); return }
      message.success('测试通过')
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'load-overview'] })
      queryClient.invalidateQueries({ queryKey: ['channels', 'simple'] })
      queryClient.invalidateQueries({ queryKey: ['channels-for-sync'] })
    },
    onError: (error: Error) => message.error(error.message),
  })

  const previewMutation = useMutation({
    mutationFn: previewModelsFromConfig,
    onSuccess: (res) => {
      if (res.code !== 0) { message.error(res.message || '拉取上游模型失败'); return }
      const models = res.data?.models ?? []
      const types = res.data?.existing_types ?? {}
      const caps = res.data?.existing_capabilities ?? {}
      setFetchedModels(models)
      setModelTypes(types)
      setModelCaps(caps)
      const existing: string[] = typeof watchedModels === 'string'
        ? watchedModels.split(',').filter(Boolean)
        : Array.isArray(watchedModels) ? watchedModels : []
      setSelectedModels(new Set(models.filter((m: string) => existing.includes(m))))
      setShowFetchedList(true)
    },
    onError: (error: Error) => message.error(error.message),
  })

  // Early return for channels query error (after all hooks)
  if (isError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="加载失败"
          description={error?.message || '渠道数据加载失败，请稍后重试'}
          showIcon
        />
      </div>
    )
  }

  // ---- Connectivity test in form ----
  const handleTestConnection = async () => {
    setTestResult('loading')
    try {
      if (editingId !== null) {
        await testMutation.mutateAsync(editingId)
      } else {
        const type = form.getFieldValue('type')
        const baseUrl = form.getFieldValue('base_url') || ''
        const keys = form.getFieldValue('keys') || ''
        const timeoutSeconds = form.getFieldValue('timeout_seconds') || 30
        await clientPostTest({ type, base_url: baseUrl, keys, timeout_seconds: timeoutSeconds })
      }
      setTestResult('success')
    } catch (err) {
      setTestResult('error')
      message.error(err instanceof Error ? err.message : '连接测试失败')
    }
  }

  // Thin wrapper for direct test API call (avoids hook overhead for unsaved channels)
  const clientPostTest = async (data: { type: string; base_url: string; keys: string; timeout_seconds: number }) => {
    const res = await testChannelFromConfig(data)
    if (res.code !== 0) throw new Error(res.message || '测试失败')
  }

  // ---- Inline model fetch ----
  const handleFetchModels = () => {
    const type = form.getFieldValue('type')
    const baseUrl = form.getFieldValue('base_url') || ''
    const keys = form.getFieldValue('keys') || ''
    previewMutation.mutate({ type, base_url: baseUrl, keys })
  }

  const syncModelsToForm = (sel: Set<string>) => {
    const sorted = Array.from(sel).sort()
    form.setFieldsValue({ models: sorted.join(',') })
  }

  const handleToggleModel = (model: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev)
      if (next.has(model)) next.delete(model)
      else next.add(model)
      syncModelsToForm(next)
      return next
    })
  }

  const handleToggleAllFetched = (checked: boolean) => {
    if (checked) {
      const all = new Set(fetchedModels)
      setSelectedModels(all)
      syncModelsToForm(all)
    } else {
      setSelectedModels(new Set())
      form.setFieldsValue({ models: '' })
    }
  }

  const allFetchedSelected = fetchedModels.length > 0 && fetchedModels.every((m) => selectedModels.has(m))
  const someFetchedSelected = fetchedModels.some((m) => selectedModels.has(m)) && !allFetchedSelected

  // ---- Form submit with dirty check ----
  const handleSubmit = (
    values: ChannelForm & { model_mapping_json?: string; status_code_mapping_json?: string },
  ) => {
    // model_mapping_json comes from ModelMappingEditor as a JSON string via getValueFromEvent
    let modelMappingParsed: Record<string, string> | undefined
    try {
      if (values.model_mapping_json) {
        const parsed = JSON.parse(values.model_mapping_json)
        if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
          modelMappingParsed = parsed
        }
      }
    } catch { /* ignore */ }

    const statusCodeMapping = parseJSON(values.status_code_mapping_json || '')
    const payload: ChannelForm & {
      model_mapping?: Record<string, string>
      status_code_mapping?: Record<string, string>
    } = { ...values }
    delete (payload as { model_mapping_json?: string }).model_mapping_json
    delete (payload as { status_code_mapping_json?: string }).status_code_mapping_json
    if (modelMappingParsed && Object.keys(modelMappingParsed).length > 0) payload.model_mapping = modelMappingParsed
    if (statusCodeMapping) payload.status_code_mapping = statusCodeMapping

    if (editingId !== null) {
      const updatePayload: Partial<
        ChannelForm & { model_mapping?: Record<string, string>; status_code_mapping?: Record<string, string> }
      > = { ...payload }
      if (!updatePayload.keys?.trim()) delete updatePayload.keys
      updateMutation.mutate({ id: editingId, values: updatePayload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleOpenModal = () => {
    setEditingId(null)
    form.setFieldsValue(defaultFormValues)
    // Capture snapshot after next tick
    setTimeout(() => { initialValuesRef.current = hashForm(form.getFieldsValue()) }, 0)
    setShowFetchedList(false)
    setFetchedModels([])
    setSelectedModels(new Set())
    setTestResult('idle')
    setIsModalOpen(true)
  }

  const handleEdit = (record: Channel) => {
    setEditingId(record.id)
    form.setFieldsValue({
      type: record.type,
      name: record.name,
      base_url: record.base_url || '',
      auth_type: record.auth_type || 'api-key',
      keys: '',
      models: record.models || '',
      groups: record.groups || '',
      weight: record.weight,
      priority: record.priority,
      timeout_seconds: record.timeout_seconds,
      auto_ban: record.auto_ban,
      model_mapping_json: formatJSON(record.model_mapping),
      status_code_mapping_json: formatJSON(record.status_code_mapping),
    })
    setTimeout(() => { initialValuesRef.current = hashForm(form.getFieldsValue()) }, 0)
    setShowFetchedList(false)
    setFetchedModels([])
    setSelectedModels(new Set())
    setTestResult('idle')
    setIsModalOpen(true)
  }

  const closeForceRef = useRef(false)

  const handleCloseModal = () => {
    if (!closeForceRef.current && dirty()) {
      modal.confirm({
        title: '放弃更改？',
        content: '表单有未保存的修改，确定要关闭吗？',
        okText: '放弃',
        cancelText: '继续编辑',
        okType: 'danger',
        onOk: () => {
          setIsModalOpen(false)
          setEditingId(null)
          form.resetFields()
          setShowFetchedList(false)
          setFetchedModels([])
          setSelectedModels(new Set())
          setTestResult('idle')
        },
      })
    } else {
      closeForceRef.current = false
      setIsModalOpen(false)
      setEditingId(null)
      form.resetFields()
      setShowFetchedList(false)
      setFetchedModels([])
      setSelectedModels(new Set())
      setTestResult('idle')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '名称',
      dataIndex: 'name',
      render: (name: string, record: Channel) => (
        <Space>
          <span>{name}</span>
          {record.status !== 1 && (
            <Tooltip title="已禁用">
              <span style={{ color: isDark ? '#aaa' : '#999', fontSize: 12 }}>(禁用)</span>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 140,
      render: (type: string) => <ChannelTypeBadge type={type} />,
    },
    { title: 'Base URL', dataIndex: 'base_url', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 70,
      render: (status: number, record: Channel) => (
        <Popconfirm
          title={`确定要${status === 1 ? '禁用' : '启用'}该渠道吗？`}
          onConfirm={() => toggleStatusMutation.mutate({ id: record.id, status: status === 1 ? 0 : 1 })}
        >
          <Switch
            checked={status === 1}
            checkedChildren="开"
            unCheckedChildren="关"
            loading={toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === record.id}
          />
        </Popconfirm>
      ),
    },
    {
      title: '模型数',
      dataIndex: 'models',
      width: 80,
      render: (models: string) => {
        if (!models) return 0
        const list = models.split(',').map((m) => m.trim()).filter(Boolean)
        return (
          <Popover
            content={list.map((m) => <div key={m}>{m}</div>)}
            title="模型列表"
          >
            <Tag color="blue" style={{ cursor: 'pointer' }}>{list.length}</Tag>
          </Popover>
        )
      },
    },
    {
      title: '失败',
      key: 'failures',
      width: 120,
      render: (_: unknown, record: Channel) => (
        <Space size={4}>
          {record.fail_count > 0 && (
            <Tooltip title={`累计失败 ${record.fail_count} 次`}>
              <Tag color="orange">{record.fail_count}</Tag>
            </Tooltip>
          )}
          {record.consecutive_failures > 0 && (
            <Tooltip title={`连续失败 ${record.consecutive_failures} 次`}>
              <Tag color="red">{record.consecutive_failures} 连</Tag>
            </Tooltip>
          )}
          {record.fail_count === 0 && '-'}
        </Space>
      ),
    },
    {
      title: '模型映射',
      dataIndex: 'model_mapping',
      width: 90,
      render: (value?: Record<string, string>) =>
        value && Object.keys(value).length > 0 ? `${Object.keys(value).length} 条` : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: Channel) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            loading={testMutation.isPending && testMutation.variables === record.id}
            onClick={() => testMutation.mutate(record.id)}
          >
            测试
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => { setHistoryChannelId(record.id); setHistoryPage(1) }}
          >
            历史
          </Button>
          <Button
            type="link"
            size="small"
            loading={testLoading[record.id]}
            onClick={async () => {
              setTestLoading(prev => ({ ...prev, [record.id]: true }))
              try {
                const res = await testChannel(record.id)
                const d = (res as any).data?.data || (res as any).data
                Modal.info({
                  title: '探测结果',
                  content: d?.status === 'ok'
                    ? (<>✅ 连接正常，响应时间 {d.response_time_ms}ms</>)
                    : (<>❌ 连接失败</>),
                })
              } catch (err: any) {
                Modal.error({ title: '探测失败', content: err?.response?.data?.message || err.message })
              } finally {
                setTestLoading(prev => ({ ...prev, [record.id]: false }))
              }
            }}
          >
            探测
          </Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定删除渠道 "${record.name}" 吗？`}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              size="small"
              loading={deleteMutation.isPending && deleteMutation.variables === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const modalTitle = editingId !== null ? '编辑渠道' : '新增渠道'
  const submitLoading = createMutation.isPending || updateMutation.isPending

  // Advanced items for collapse
  const advancedItems = [
    {
      key: 'mapping',
      label: '高级设置',
      children: (
        <>
          <Form.Item
            label="模型映射"
            name="model_mapping_json"
            getValueFromEvent={(val: Record<string, string>) => JSON.stringify(val || {})}
            getValueProps={(val: string) => {
              try {
                return { value: val ? JSON.parse(val) : {} }
              } catch {
                return { value: {} }
              }
            }}
          >
            <ModelMappingEditor modelOptions={availableModelNames} />
          </Form.Item>

          <Form.Item
            label="状态码映射 (JSON)"
            name="status_code_mapping_json"
            rules={[{ validator: jsonValidator }]}
          >
            <Input.TextArea
              rows={3}
              placeholder='{"429": "503"}'
              maxLength={5000}
            />
          </Form.Item>

          <Space size="large" wrap>
            <Form.Item label="权重" name="weight">
              <InputNumber min={0} />
            </Form.Item>

            <Form.Item label="优先级" name="priority">
              <InputNumber min={0} />
            </Form.Item>

            <Form.Item label="超时(秒)" name="timeout_seconds">
              <InputNumber min={1} max={300} />
            </Form.Item>
          </Space>

          <Form.Item name="auto_ban" valuePropName="checked">
            <Switch checkedChildren="自动封禁" unCheckedChildren="不自动封禁" />
          </Form.Item>
        </>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val as 'list' | 'load')}
            options={[
              { label: '列表', value: 'list' },
              { label: '负载', value: 'load' },
            ]}
          />
          <Input.Search
            placeholder="搜索渠道名称"
            onSearch={(v) => { setKeyword(v); setPage(1) }}
            style={{ width: 280 }}
            allowClear
          />
          {/* Quick filter chips */}
          {Object.entries(CHANNEL_COLORS)
            .filter(([k]) => k !== 'custom' && !k.includes('compatible'))
            .slice(0, 6)
            .map(([type, c]) => (
              <Tag
                key={type}
                style={{
                  cursor: 'pointer',
                  color: keyword === type ? '#fff' : c.color,
                  background: keyword === type ? c.color : c.bg,
                  border: `1px solid ${c.border}`,
                }}
                onClick={() => {
                  setKeyword(keyword === type ? '' : type)
                  setPage(1)
                }}
              >
                {getChannelLabel(type)}
              </Tag>
            ))}
        </Space>
        <Space>
          <Button type="primary" onClick={handleOpenModal}>
            新增渠道
          </Button>
          <Button onClick={() => setImportModalOpen(true)}>批量导入</Button>
        </Space>
      </div>

      {/* Health summary cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" hoverable onClick={() => { setKeyword(''); setPage(1) }}>
            <Statistic title="总渠道数" value={channelStats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic title="启用中" value={channelStats.enabled} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic title="自动禁用" value={channelStats.autoBanned} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic title="连续失败≥3" value={channelStats.failing} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      {/* Load View */}
      {viewMode === 'load' && (
        <ChannelLoadChart
          loadChannels={loadChannels}
          isDark={isDark}
          loading={loadLoading}
        />
      )}

      {/* Table */}
      {viewMode === 'list' && (!isLoading && (data?.data?.data || []).length === 0) ? (
        <EmptyState
          description="暂无渠道数据"
          actionText="新增渠道"
          onAction={handleOpenModal}
        />
      ) : (
        <>
          {viewMode === 'list' && selectedRowKeys.length > 0 && (
            <Space style={{ marginBottom: 16 }}>
              <span>已选 {selectedRowKeys.length} 项</span>
              <Button
                danger
                loading={batchDeleting}
                onClick={() => {
                  confirmActionRef.current = handleBatchDelete
                  setConfirmOpen(true)
                }}
              >
                批量删除
              </Button>
            </Space>
          )}
          {viewMode === 'list' && (
          <Table
            loading={isLoading}
            dataSource={data?.data?.data || []}
            rowKey="id"
            size="middle"
            scroll={{ x: 'max-content' }}
            pagination={{
              current: page,
              pageSize: 20,
              total: data?.data?.pagination?.total || 0,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
            columns={columns}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
          />
          )}
        </>
      )}

      {/* Edit Modal */}
      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={handleCloseModal}
        onOk={async () => { try { await form.submit() } catch { /* validation failed, Ant Design shows inline errors */ } }}
        confirmLoading={submitLoading}
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={defaultFormValues}
          onValuesChange={(changed) => {
            // Auto-fill default base_url when channel type changes
            if ('type' in changed && changed.type) {
              const url = CHANNEL_DEFAULT_URLS[changed.type]
              if (url) {
                form.setFieldsValue({ base_url: url })
              }
            }
          }}
        >
          {/* ---- Basic Section ---- */}
          <Typography.Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            基本信息
          </Typography.Text>

          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={CHANNEL_TYPES} showSearch />
          </Form.Item>

          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="渠道名称" />
          </Form.Item>

          <Form.Item label="Base URL" name="base_url" rules={[{ validator: urlValidator }]}>
            <Input placeholder="https://api.example.com" />
          </Form.Item>

          <Form.Item label="认证类型" name="auth_type">
            <Select
              options={[
                { value: 'api-key', label: 'API Key (Bearer)' },
                { value: 'api-key-header', label: 'API Key (自定义Header)' },
                { value: 'oauth', label: 'OAuth 2.0' },
                { value: 'aws-sigv4', label: 'AWS Signature V4' },
                { value: 'gcp-sa', label: 'GCP Service Account' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Keys"
            name="keys"
            rules={editingId === null ? [{ required: true, message: '请输入密钥' }] : []}
            help={editingId !== null ? '留空则不修改现有 Key' : undefined}
          >
            <Input.TextArea rows={3} placeholder={editingId !== null ? '留空则不修改现有 Key' : '每行一个 API Key'} maxLength={10000} />
          </Form.Item>

          <Form.Item
            label="Models"
            name="models"
            normalize={(value) => (Array.isArray(value) ? value.join(',') : value)}
            getValueProps={(value: string) => ({
              value: value ? value.split(',').filter(Boolean) : [],
            })}
          >
            <Select
              mode="tags"
              placeholder="选择模型，或输入自定义模型名回车添加"
              tokenSeparators={[',']}
              maxTagCount="responsive"
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              options={[...new Set([...availableModelNames, ...fetchedModels])].map((name) => ({ value: name, label: name }))}
              style={{ width: '100%' }}
            />
          </Form.Item>

          {/* ---- Inline upstream model fetch ---- */}
          <div style={{ marginTop: -8, marginBottom: 8 }}>
            <Space>
              <Button
                type="link"
                size="small"
                loading={previewMutation.isPending}
                onClick={handleFetchModels}
              >
                从上游拉取模型
              </Button>
              <Button
                type="link"
                size="small"
                loading={testResult === 'loading'}
                onClick={handleTestConnection}
                style={{
                  color:
                    testResult === 'success' ? '#52c41a' :
                    testResult === 'error' ? '#ff4d4f' : undefined,
                }}
              >
                {testResult === 'success' ? '✓ 连接成功' :
                 testResult === 'error' ? '✗ 连接失败' :
                 '测试连接'}
              </Button>
            </Space>
            {showFetchedList && fetchedModels.length > 0 && (
              <div
                style={{
                  border: `1px solid ${isDark ? '#434343' : '#d9d9d9'}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  maxHeight: 200,
                  overflowY: 'auto',
                  marginTop: 4,
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <Checkbox
                    checked={allFetchedSelected}
                    indeterminate={someFetchedSelected}
                    onChange={(e: CheckboxChangeEvent) => handleToggleAllFetched(e.target.checked)}
                  >
                    <Typography.Text strong>
                      全选 ({selectedModels.size}/{fetchedModels.length})
                    </Typography.Text>
                  </Checkbox>
                </div>
                {fetchedModels.map((m) => (
                  <div
                    key={m}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '2px 0',
                      gap: 8,
                    }}
                  >
                    <Checkbox
                      checked={selectedModels.has(m)}
                      onChange={() => handleToggleModel(m)}
                    >
                      {m}
                    </Checkbox>
                    <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
                      <Tag color="blue" style={{ margin: 0 }}>
                        {modelTypes[m] || 'llm'}
                      </Tag>
                      {(modelCaps[m] || []).map((c) => (
                        <Tag key={c} style={{ margin: 0, fontSize: 11 }}>
                          {CAPABILITY_LABELS[c] ?? c}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                ))}
              </div>
            )}
            {showFetchedList && fetchedModels.length === 0 && (
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                上游未返回任何模型
              </Typography.Text>
            )}
          </div>

          <Form.Item label="Groups" name="groups">
            <Input.TextArea rows={2} placeholder="逗号分隔的分组（如：default,vip）" />
          </Form.Item>

          {/* ---- Advanced Section (Collapsible) ---- */}
          <Collapse
            ghost
            size="small"
            items={advancedItems}
            style={{ marginTop: 8 }}
          />
        </Form>
      </Modal>

      {/* Test History Modal */}
      <ChannelTestModal
        open={historyChannelId !== null}
        channelId={historyChannelId}
        loading={historyLoading}
        logs={testLogs}
        total={testLogsTotal}
        page={historyPage}
        onPageChange={setHistoryPage}
        onClose={() => setHistoryChannelId(null)}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="批量导入渠道"
        templateColumns={['type', 'name', 'base_url', 'keys', 'models', 'groups', 'weight', 'priority']}
        templateUrl="/api/import/channels"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['channels'] })}
      />

      {/* Confirm Password Modal */}
      <ConfirmPasswordModal
        open={confirmOpen}
        title="确认批量删除渠道"
        description={`确定删除选中的 ${selectedRowKeys.length} 个渠道吗？此操作不可撤销。`}
        onConfirm={() => {
          confirmActionRef.current?.()
          confirmActionRef.current = null
          setConfirmOpen(false)
        }}
        onCancel={() => {
          confirmActionRef.current = null
          setConfirmOpen(false)
        }}
      />
    </div>
  )
}
