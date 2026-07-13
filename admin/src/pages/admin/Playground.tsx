import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Alert,
  Card,
  Input,
  Slider,
  InputNumber,
  Button,
  Switch,
  Tag,
  Typography,
  Space,
  Divider,
  Spin,
  message,
  Tooltip,
  Modal,
} from 'antd'
import {
  SendOutlined,
  DeleteOutlined,
  CopyOutlined,
  RobotOutlined,
  SettingOutlined,
  ExperimentOutlined,
  CaretRightOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation } from '@tanstack/react-query'
import { listModels, type Model } from '../../api/model'
import { listPromptTemplates, usePromptTemplate, type PromptTemplate as PromptTemplateType } from '../../api/prompt-template'
import { useThemeStore } from '../../stores/themeStore'
import { useAuthStore } from '../../stores/authStore'
import TrialStatus from '../../components/playground/TrialStatus'
import ModelSelector, { buildModelOptions } from '../../components/playground/ModelSelector'
import ChatMessages, { type Message } from '../../components/playground/ChatMessages'

const { Text } = Typography
const { TextArea } = Input

// ── Types ──

interface PlaygroundParams {
  model: string
  temperature: number
  maxTokens: number
  topP: number
  systemPrompt: string
}

interface ResponseMeta {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  responseTimeMs: number
  model: string
}

interface CompareMeta {
  modelA: ResponseMeta | null
  modelB: ResponseMeta | null
}

const defaultParams: PlaygroundParams = {
  model: '',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  systemPrompt: '',
}

// ── Helpers ──

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// ── Component ──

export default function Playground() {
  const [messages, setMessages] = useState<Message[]>([])
  const [params, setParams] = useState<PlaygroundParams>(defaultParams)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [responseMeta, setResponseMeta] = useState<ResponseMeta | null>(null)
  const [compareMeta, setCompareMeta] = useState<CompareMeta | null>(null)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [streamError, setStreamError] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)

  // ── Responsive breakpoints ──
  const getBreakpoints = () => ({
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
  })
  const [breakpoints, setBreakpoints] = useState(getBreakpoints)
  const { isMobile, isTablet } = breakpoints

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        const bp = getBreakpoints()
        setBreakpoints(bp)
        // Auto-collapse sidebar when switching to mobile
        if (bp.isMobile) {
          setLeftCollapsed(true)
        } else {
          setLeftCollapsed(false)
        }
      }, 100)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [])

  // Compare mode states
  const [compareMode, setCompareMode] = useState(false)
  const [modelB, setModelB] = useState('')
  const [modelBParams, setModelBParams] = useState({
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1,
  })
  const [modelBSystemPrompt, setModelBSystemPrompt] = useState('')
  const [modelBMessages, setModelBMessages] = useState<Message[]>([])
  const [loadingB, setLoadingB] = useState(false)
  const abortControllerBRef = useRef<AbortController | null>(null)

  // Prompt template states
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateCategory, setTemplateCategory] = useState('')
  const [templateKeyword, setTemplateKeyword] = useState('')
  const [templateTarget, setTemplateTarget] = useState<'A' | 'B'>('A')
  const [templateVariableInputs, setTemplateVariableInputs] = useState<Record<string, string>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplateType | null>(null)

  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const { user, token: authToken } = useAuthStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // ── Fetch models ──
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['models', 'playground'],
    queryFn: () => listModels(1, 200, ''),
    staleTime: 60_000,
  })

  // Prompt templates query
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['prompt-templates', templateCategory, templateKeyword],
    queryFn: () => listPromptTemplates({ category: templateCategory || undefined, keyword: templateKeyword || undefined, page_size: 100 }),
    staleTime: 5 * 60_000,
  })
  const templates = templatesData?.data?.data ?? []

  const useTemplateMutation = useMutation({
    mutationFn: usePromptTemplate,
    onSuccess: () => { message.success('模板已应用') },
    onError: (err: unknown) => { message.error(err instanceof Error ? err.message : '应用模板失败') },
  })

  const models = modelsData?.data?.data ?? []

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Auto-select first model (initial only) ──
  const initialModelRef = useRef(false)
  const initialModelBRef = useRef(false)
  useEffect(() => {
    if (!initialModelRef.current && models.length > 0 && !params.model) {
      initialModelRef.current = true
      setParams((prev) => ({ ...prev, model: models[0].model_name }))
    }
  }, [models, params.model])
  useEffect(() => {
    if (!initialModelBRef.current && models.length > 1 && !modelB) {
      initialModelBRef.current = true
      setModelB(models[1].model_name)
    }
  }, [models, modelB])

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      abortControllerBRef.current?.abort()
    }
  }, [])

  // ── Send message ──
  // eslint-disable-next-line react-hooks/immutability -- state setters passed as streaming callbacks by design
  const handleSend = useCallback(async () => {
    const content = inputValue.trim()
    if (!content || !params.model || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setModelBMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setResponseMeta(null)
    setStreamError(false)

    // Build messages array for API
    const apiMessages: { role: string; content: string }[] = []
    if (params.systemPrompt.trim()) {
      apiMessages.push({ role: 'system', content: params.systemPrompt.trim() })
    }
    for (const m of messages) {
      if (m.role !== 'system') {
        apiMessages.push({ role: m.role, content: m.content })
      }
    }
    apiMessages.push({ role: 'user', content })

    setLoading(true)
    const controller = new AbortController()
    abortControllerRef.current = controller

      const sendOneModel = async (
        modelName: string,
        sysPrompt: string,
        temp: number,
        maxTok: number,
        topPVal: number,
        prevMsgs: Message[],
        setMsgsFn: React.Dispatch<React.SetStateAction<Message[]>>,
        signal: AbortSignal,
      ): Promise<ResponseMeta> => {
        const startTime = performance.now()
        const apiMessages2: { role: string; content: string }[] = []
        if (sysPrompt.trim()) {
          apiMessages2.push({ role: 'system', content: sysPrompt.trim() })
        }
        for (const m of prevMsgs) {
          if (m.role !== 'system') {
            apiMessages2.push({ role: m.role, content: m.content })
          }
        }
        apiMessages2.push({ role: 'user', content })

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          // Trial logic now handled server-side via /api/playground/chat
        }

        const response = await fetch('/api/playground/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelName,
            messages: apiMessages2,
            temperature: temp,
            max_tokens: maxTok,
            top_p: topPVal,
            stream: true,
          }),
          signal,
        })

        if (!response.ok) {
          if (response.status === 401) {
            try { localStorage.removeItem('juhe_token') } catch { /* ignore */ }
            useAuthStore.getState().logout()
            throw new Error('未登录')
          }
          const errText = await response.text()
          let errorMsg = `HTTP ${response.status}`
          try {
            const errJson = JSON.parse(errText)
            errorMsg = errJson?.message || errJson?.error?.message || errorMsg
          } catch {
            errorMsg = errText || errorMsg
          }
          throw new Error(errorMsg)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let fullContent = ''
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        }

        setMsgsFn((prev) => [...prev, assistantMsg])

        let usageInfo: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null
        let leftover = '' // Buffer partial lines across chunk boundaries

        try {
        while (true) {
          if (signal.aborted) break
          const { done, value } = await reader.read()
          if (done) {
            // Flush any remaining data in the buffer
            if (leftover) {
              if (leftover.startsWith('data:')) {
                const dataStr = leftover.slice(5).trim()
                if (dataStr && dataStr !== '[DONE]') {
                  try {
                    const data = JSON.parse(dataStr)
                    const choice = data.choices?.[0]
                    if (choice?.delta?.content) {
                      fullContent += choice.delta.content
                      setMsgsFn((prev) =>
                        prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullContent } : m)),
                      )
                    }
                    if (data.usage) usageInfo = data.usage
                  } catch { /* ignore */ }
                }
              }
            }
            break
          }

          const chunk = leftover + decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          // Last element may be incomplete — save it for the next chunk
          leftover = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim()
              if (!dataStr) continue
              if (dataStr === '[DONE]') continue

              try {
                const data = JSON.parse(dataStr)
                const choice = data.choices?.[0]
                if (choice?.delta?.content) {
                  fullContent += choice.delta.content
                  setMsgsFn((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: fullContent } : m,
                    ),
                  )
                }
                if (data.usage) {
                  usageInfo = data.usage
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
        } catch (streamErr: unknown) {
          // Stream interrupted (network drop, etc.) — append warning to partial content
          const warning = '\n\n⚠️ 连接中断'
          fullContent += warning
          setMsgsFn((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullContent } : m,
            ),
          )
          throw streamErr
        }

        const elapsed = performance.now() - startTime
        return {
          promptTokens: usageInfo?.prompt_tokens ?? 0,
          completionTokens: usageInfo?.completion_tokens ?? 0,
          totalTokens: usageInfo?.total_tokens ?? 0,
          responseTimeMs: Math.round(elapsed),
          model: modelName,
        }
      }

      try {
        if (compareMode && modelB) {
          // Dual send — use allSettled so one model's failure doesn't pollute the other
          setLoading(true)
          setLoadingB(true)
          setCompareMeta(null)
          const controllerB = new AbortController()
          abortControllerBRef.current = controllerB

          /* eslint-disable react-hooks/immutability -- setMessages/setModelBMessages are streaming callbacks */
          const [resultA, resultB] = await Promise.allSettled([
            sendOneModel(params.model, params.systemPrompt, params.temperature, params.maxTokens, params.topP, messages, setMessages, controller.signal),
            sendOneModel(modelB, modelBSystemPrompt, modelBParams.temperature, modelBParams.maxTokens, modelBParams.topP, modelBMessages, setModelBMessages, controllerB.signal),
          ])
          /* eslint-enable react-hooks/immutability */

          if (resultA.status === 'fulfilled') {
            setResponseMeta(resultA.value)
          } else if (!(resultA.reason instanceof DOMException && resultA.reason.name === 'AbortError')) {
            setStreamError(true)
            const errorMsg = resultA.reason instanceof Error ? resultA.reason.message : String(resultA.reason)
            message.error(`模型 A 请求失败: ${errorMsg}`)
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `❌ 错误: ${errorMsg}`, timestamp: Date.now() }])
          }
          if (resultB.status === 'fulfilled') {
            setCompareMeta({ modelA: resultA.status === 'fulfilled' ? resultA.value : { promptTokens: 0, completionTokens: 0, totalTokens: 0, responseTimeMs: 0, model: params.model }, modelB: resultB.value })
          } else if (!(resultB.reason instanceof DOMException && resultB.reason.name === 'AbortError')) {
            setStreamError(true)
            const errorMsg = resultB.reason instanceof Error ? resultB.reason.message : String(resultB.reason)
            message.error(`模型 B 请求失败: ${errorMsg}`)
            setModelBMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `❌ 错误: ${errorMsg}`, timestamp: Date.now() }])
          }
        } else {
          // Single model send
          setLoading(true)
          const meta = await sendOneModel(
            params.model,
            params.systemPrompt,
            params.temperature,
            params.maxTokens,
            params.topP,
            messages,
            setMessages,
            controller.signal,
          )
          setResponseMeta(meta)
        }
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setStreamError(true)
          const errorMsg = err instanceof Error ? err.message : String(err)
          message.error(`请求失败: ${errorMsg}`)
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', content: `❌ 错误: ${errorMsg}`, timestamp: Date.now() },
          ])
        }
      } finally {
        setLoading(false)
        setLoadingB(false)
        abortControllerRef.current = null
        abortControllerBRef.current = null
      }
  }, [inputValue, params, messages, loading, compareMode, modelB, modelBSystemPrompt, modelBParams, modelBMessages, authToken])

  // ── Keyboard shortcut ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // ── Clear conversation ──
  const handleClear = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerBRef.current?.abort()
    setMessages([])
    setModelBMessages([])
    setResponseMeta(null)
    setCompareMeta(null)
    setLoading(false)
    setLoadingB(false)
  }, [])

  // ── Copy response ──
  const handleCopyResponse = useCallback(async () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant?.content) {
      const text = lastAssistant.content
      try {
        await navigator.clipboard.writeText(text)
        message.success('已复制到剪贴板')
      } catch {
        message.info('请手动复制')
      }
    }
  }, [messages])

  // ── Stop generation ──
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerBRef.current?.abort()
  }, [])

  // ── Model options ──
  const modelOptions = buildModelOptions(models)

  const selectedModel = models.find((m: Model) => m.model_name === params.model)

  // ── Render ──
  return (
    <>
      {/* Mobile: Floating Action Button to toggle settings sidebar */}
      {isMobile && (
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<SettingOutlined />}
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1001,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        />
      )}

      {/* Mobile: Backdrop overlay when sidebar is open */}
      {isMobile && !leftCollapsed && (
        <div
          onClick={() => setLeftCollapsed(true)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 998,
          }}
        />
      )}

      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        height: isMobile ? 'auto' : 'calc(100vh - 180px)',
        gap: 12,
        minHeight: isMobile ? '100vh' : 500,
      }}>
        {/* ── Left Sidebar: Model & Params ── */}
        <Card
          size="small"
          title={
            <Space>
              <SettingOutlined />
              <span>模型与参数</span>
              {!isMobile && (
                <Switch
                  checkedChildren="对比"
                  unCheckedChildren="单模"
                  checked={compareMode}
                  onChange={setCompareMode}
                  size="small"
                />
              )}
            </Space>
          }
          extra={
            <Button
              type="text"
              size="small"
              icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setLeftCollapsed(!leftCollapsed)}
            />
          }
          style={{
            ...(isMobile
              ? {
                  position: 'fixed',
                  top: 0,
                  left: leftCollapsed ? '-100%' : 0,
                  width: 'min(85vw, 380px)',
                  height: '100vh',
                  zIndex: 999,
                  borderRadius: 0,
                  transition: 'left 0.3s ease',
                }
              : {
                  width: leftCollapsed ? 48 : compareMode ? 420 : 280,
                  minWidth: leftCollapsed ? 48 : compareMode ? 420 : 280,
                  transition: 'width 0.3s, min-width 0.3s',
                  flexShrink: 0,
                }),
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: isDark ? '#1f1f1f' : '#fff',
          }}
          styles={{ body: { flex: 1, overflow: 'auto', display: leftCollapsed ? 'none' : 'block' } }}
        >
          {!leftCollapsed && (
            <>
              {/* Mobile: Switch inside sidebar */}
              {isMobile && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12 }}>对比模式</Text>
                    <Switch
                      checkedChildren="对比"
                      unCheckedChildren="单模"
                      checked={compareMode}
                      onChange={setCompareMode}
                      size="small"
                    />
                  </div>
                </div>
              )}

              {/* Free trial / budget indicator */}
              <TrialStatus user={user} isDark={isDark} />

              {/* Model Select */}
              <ModelSelector
                compareMode={compareMode}
                model={params.model}
                modelB={modelB}
                modelsLoading={modelsLoading}
                modelOptions={modelOptions}
                onModelAChange={(val) => setParams((p) => ({ ...p, model: val }))}
                onModelBChange={setModelB}
              />

              <Divider style={{ margin: '12px 0' }} />

              {/* System Prompt - dual mode */}
              {compareMode ? (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 12 }}>系统提示词 A</Text>
                      <Button
                        type="link"
                        size="small"
                        icon={<FileTextOutlined />}
                        onClick={() => { setTemplateTarget('A'); setTemplateModalOpen(true) }}
                      >
                        模板
                      </Button>
                    </div>
                    <TextArea
                      rows={3}
                      value={params.systemPrompt}
                      onChange={(e) => setParams((p) => ({ ...p, systemPrompt: e.target.value }))}
                      placeholder="模型 A 的系统提示词..."
                      style={{ fontSize: 13 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 12 }}>系统提示词 B</Text>
                      <Button
                        type="link"
                        size="small"
                        icon={<FileTextOutlined />}
                        onClick={() => { setTemplateTarget('B'); setTemplateModalOpen(true) }}
                      >
                        模板
                      </Button>
                    </div>
                    <TextArea
                      rows={3}
                      value={modelBSystemPrompt}
                      onChange={(e) => setModelBSystemPrompt(e.target.value)}
                      placeholder="模型 B 的系统提示词..."
                      style={{ fontSize: 13 }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      系统提示词 (System Prompt)
                    </Text>
                    <Button
                      type="link"
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={() => { setTemplateTarget('A'); setTemplateModalOpen(true) }}
                    >
                      模板
                    </Button>
                  </div>
                  <TextArea
                    rows={4}
                    value={params.systemPrompt}
                    onChange={(e) => setParams((p) => ({ ...p, systemPrompt: e.target.value }))}
                    placeholder="可选：设定 AI 的行为、角色或上下文..."
                    style={{ fontSize: 13 }}
                  />
                </div>
              )}

              <Divider style={{ margin: '12px 0' }} />

              {/* Parameters */}
              {compareMode ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Model A params */}
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 11, color: '#1677ff' }}>参数 A</Text>
                    <div style={{ marginBottom: 12, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 11 }}>温度</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{params.temperature.toFixed(1)}</Text>
                      </div>
                      <Slider
                        min={0} max={2} step={0.1}
                        value={params.temperature}
                        onChange={(val) => setParams((p) => ({ ...p, temperature: val }))}
                        tooltip={{ formatter: (v) => v?.toFixed(1) }}
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <Text style={{ display: 'block', marginBottom: 2, fontSize: 11 }}>最大 Tokens</Text>
                      <InputNumber
                        min={1} max={32000}
                        value={params.maxTokens}
                        onChange={(val) => setParams((p) => ({ ...p, maxTokens: val ?? 2048 }))}
                        style={{ width: '100%' }} size="small"
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 11 }}>Top P</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{params.topP.toFixed(2)}</Text>
                      </div>
                      <Slider
                        min={0} max={1} step={0.05}
                        value={params.topP}
                        onChange={(val) => setParams((p) => ({ ...p, topP: val }))}
                        tooltip={{ formatter: (v) => v?.toFixed(2) }}
                      />
                    </div>
                  </div>

                  <Divider type="vertical" style={{ height: 'auto' }} />

                  {/* Model B params */}
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 11, color: '#52c41a' }}>参数 B</Text>
                    <div style={{ marginBottom: 12, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 11 }}>温度</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{modelBParams.temperature.toFixed(1)}</Text>
                      </div>
                      <Slider
                        min={0} max={2} step={0.1}
                        value={modelBParams.temperature}
                        onChange={(val) => setModelBParams((p) => ({ ...p, temperature: val }))}
                        tooltip={{ formatter: (v) => v?.toFixed(1) }}
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <Text style={{ display: 'block', marginBottom: 2, fontSize: 11 }}>最大 Tokens</Text>
                      <InputNumber
                        min={1} max={32000}
                        value={modelBParams.maxTokens}
                        onChange={(val) => setModelBParams((p) => ({ ...p, maxTokens: val ?? 2048 }))}
                        style={{ width: '100%' }} size="small"
                      />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 11 }}>Top P</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{modelBParams.topP.toFixed(2)}</Text>
                      </div>
                      <Slider
                        min={0} max={1} step={0.05}
                        value={modelBParams.topP}
                        onChange={(val) => setModelBParams((p) => ({ ...p, topP: val }))}
                        tooltip={{ formatter: (v) => v?.toFixed(2) }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Temperature */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 12 }}>
                        温度 (Temperature)
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {params.temperature.toFixed(1)}
                      </Text>
                    </div>
                    <Slider
                      min={0}
                      max={2}
                      step={0.1}
                      value={params.temperature}
                      onChange={(val) => setParams((p) => ({ ...p, temperature: val }))}
                      tooltip={{ formatter: (v) => v?.toFixed(1) }}
                    />
                  </div>

                  {/* Max Tokens */}
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
                      最大输出 Tokens
                    </Text>
                    <InputNumber
                      min={1}
                      max={32000}
                      value={params.maxTokens}
                      onChange={(val) => setParams((p) => ({ ...p, maxTokens: val ?? 2048 }))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Top P */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 12 }}>
                        Top P
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {params.topP.toFixed(2)}
                      </Text>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      value={params.topP}
                      onChange={(val) => setParams((p) => ({ ...p, topP: val }))}
                      tooltip={{ formatter: (v) => v?.toFixed(2) }}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </Card>

        {/* ── Center: Chat Interface ── */}
        <Card
          size="small"
          title={
            <Space>
              <ExperimentOutlined />
              <span>{compareMode ? '模型对比' : '对话'}</span>
              {compareMode && <Tag color="blue" style={{ fontSize: 10 }}>{params.model} vs {modelB}</Tag>}
            </Space>
          }
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: isDark ? '#1f1f1f' : '#fff',
            ...(isMobile ? { minHeight: 'calc(100vh - 24px)' } : {}),
          }}
          styles={{
            body: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
            },
          }}
        >
          {/* System Message Banner */}
          {!compareMode && params.systemPrompt.trim() && (
            <div
              style={{
                padding: '8px 16px',
                background: isDark ? '#1a1a3e' : '#f0f5ff',
                borderBottom: `1px solid ${isDark ? '#303030' : '#d6e4ff'}`,
                fontSize: 12,
                color: isDark ? '#b3bfff' : '#1d39c4',
                flexShrink: 0,
              }}
            >
              <strong>System:</strong> {params.systemPrompt}
            </div>
          )}

          {/* Messages Area — compare mode splits into two columns (desktop) or stacks vertically (tablet/mobile) */}
          {compareMode ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: isTablet || isMobile ? 'column' : 'row',
              overflow: 'hidden',
            }}>
              {/* Model A */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                borderRight: (isTablet || isMobile) ? undefined : `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
                borderBottom: (isTablet || isMobile) ? `1px solid ${isDark ? '#303030' : '#f0f0f0'}` : undefined,
                minHeight: (isTablet || isMobile) ? 0 : undefined,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: isDark ? '#1a1a3e' : '#e6f7ff', borderBottom: `1px solid ${isDark ? '#303030' : '#d6e4ff'}`, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ color: '#1677ff' }}>🔵 {params.model || '模型 A'}</span>
                  {responseMeta && <span style={{ color: isDark ? '#999' : '#888' }}>{formatMs(responseMeta.responseTimeMs)}</span>}
                </div>
                <ChatMessages
                  messages={messages.filter((m) => m.role !== 'system')}
                  isDark={isDark}
                  loading={loading}
                  compact
                />
              </div>
              {/* Model B */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: (isTablet || isMobile) ? 0 : undefined,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, background: isDark ? '#1e3e1e' : '#f6ffed', borderBottom: `1px solid ${isDark ? '#303030' : '#b7eb8f'}`, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ color: '#52c41a' }}>🟢 {modelB || '模型 B'}</span>
                  {compareMeta?.modelB && <span style={{ color: isDark ? '#999' : '#888' }}>{formatMs(compareMeta.modelB.responseTimeMs)}</span>}
                </div>
                <ChatMessages
                  messages={modelBMessages.filter((m) => m.role !== 'system')}
                  isDark={isDark}
                  loading={loadingB}
                  compact
                />
              </div>
            </div>
          ) : (
            <>
              <ChatMessages
                messages={messages.filter((m) => m.role !== 'system')}
                isDark={isDark}
                loading={loading}
                emptyText="选择一个模型，开始对话"
                emptyIcon="experiment"
                scrollAnchorRef={messagesEndRef}
              />

              {/* Inline response meta on mobile/tablet (replaces right sidebar) */}
              {(isMobile || isTablet) && responseMeta && (
                <div style={{
                  borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
                  padding: '8px 16px',
                  background: isDark ? '#1a1a1a' : '#fafafa',
                  flexShrink: 0,
                  display: 'flex',
                  gap: 16,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  fontSize: 12,
                }}>
                  <Tooltip title="Token 用量">
                    <Space size={4}>
                      <ThunderboltOutlined style={{ color: '#1677ff' }} />
                      <Text style={{ fontSize: 12 }}>输入 {responseMeta.promptTokens.toLocaleString()}</Text>
                      <Text style={{ fontSize: 12 }}>输出 {responseMeta.completionTokens.toLocaleString()}</Text>
                      <Text strong style={{ fontSize: 12 }}>总计 {responseMeta.totalTokens.toLocaleString()}</Text>
                    </Space>
                  </Tooltip>
                  <Divider type="vertical" />
                  <Space size={4}>
                    <ClockCircleOutlined style={{ color: isDark ? '#999' : '#666' }} />
                    <Text style={{ fontSize: 12 }}>{formatMs(responseMeta.responseTimeMs)}</Text>
                  </Space>
                  <Divider type="vertical" />
                  <Text type="secondary" style={{ fontSize: 12 }}>{responseMeta.model}</Text>
                  <div style={{ flex: 1 }} />
                  <Button type="link" size="small" icon={<CopyOutlined />} onClick={handleCopyResponse}>
                    复制
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Input Area */}
          <div
            style={{
              borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
              padding: '12px 16px',
              background: isDark ? '#1f1f1f' : '#fff',
              flexShrink: 0,
            }}
          >
            <TextArea
              rows={isMobile ? 2 : 3}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Ctrl+Enter 发送)"
              disabled={(!params.model || (compareMode && !modelB)) || loading || loadingB}
              style={{ marginBottom: 8 }}
            />
            {streamError && (
              <Alert
                type="warning"
                message="上次请求发生错误，请检查网络连接或重试"
                closable
                onClose={() => setStreamError(false)}
                style={{ marginBottom: 8 }}
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {inputValue.length} 字符
              </Text>
              <Space>
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    Modal.confirm({
                      title: '确定要清除对话吗？',
                      content: '清除后对话历史将无法恢复。',
                      onOk: () => handleClear(),
                    })
                  }}
                  disabled={messages.length === 0 && !loading}
                >
                  清空对话
                </Button>
                {loading || loadingB ? (
                  <Button danger icon={<Spin size="small" />} onClick={handleStop}>
                    停止
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={compareMode ? <SwapOutlined /> : <SendOutlined />}
                    onClick={handleSend}
                    disabled={(!params.model || (compareMode && !modelB)) || !inputValue.trim()}
                  >
                    {compareMode ? '发送 (对比)' : '发送'}
                  </Button>
                )}
              </Space>
            </div>
          </div>

          {/* Comparison Summary */}
          {compareMode && compareMeta && (
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`, background: isDark ? '#1a1a1a' : '#fafafa', flexShrink: 0 }}>
              <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>对比汇总</Text>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: isMobile ? 400 : undefined }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${isDark ? '#333' : '#e8e8e8'}` }}>
                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>指标</th>
                      <th style={{ textAlign: 'center', padding: '4px 8px', color: '#1677ff' }}>模型 A ({params.model})</th>
                      <th style={{ textAlign: 'center', padding: '4px 8px', color: '#52c41a' }}>模型 B ({modelB})</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${isDark ? '#333' : '#f0f0f0'}` }}>
                      <td style={{ padding: '4px 8px' }}>Token 用量 (输入)</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px' }}>{compareMeta.modelA?.promptTokens.toLocaleString() ?? '-'}</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px' }}>{compareMeta.modelB?.promptTokens.toLocaleString() ?? '-'}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${isDark ? '#333' : '#f0f0f0'}` }}>
                      <td style={{ padding: '4px 8px' }}>Token 用量 (输出)</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px' }}>{compareMeta.modelA?.completionTokens.toLocaleString() ?? '-'}</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px' }}>{compareMeta.modelB?.completionTokens.toLocaleString() ?? '-'}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${isDark ? '#333' : '#f0f0f0'}` }}>
                      <td style={{ padding: '4px 8px' }}>Token 用量 (总计)</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600 }}>{compareMeta.modelA?.totalTokens.toLocaleString() ?? '-'}</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600 }}>{compareMeta.modelB?.totalTokens.toLocaleString() ?? '-'}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${isDark ? '#333' : '#f0f0f0'}` }}>
                      <td style={{ padding: '4px 8px' }}>响应时间</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px' }}>{compareMeta.modelA ? formatMs(compareMeta.modelA.responseTimeMs) : '-'}</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px' }}>{compareMeta.modelB ? formatMs(compareMeta.modelB.responseTimeMs) : '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 8px' }}>输出长度</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px' }}>{compareMeta.modelA ? `${compareMeta.modelA.completionTokens.toLocaleString()} tokens` : '-'}</td>
                      <td style={{ textAlign: 'center', padding: '4px 8px' }}>{compareMeta.modelB ? `${compareMeta.modelB.completionTokens.toLocaleString()} tokens` : '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>

        {/* ── Right Sidebar: Response Info (desktop only) ── */}
        {!isMobile && !isTablet && (
          <Card
            size="small"
            title={
              <Space>
                <ThunderboltOutlined />
                <span>响应信息</span>
              </Space>
            }
            extra={
              <Space size={4}>
                {responseMeta && (
                  <Tooltip title="复制最后一条回复">
                    <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopyResponse} />
                  </Tooltip>
                )}
                <Button
                  type="text"
                  size="small"
                  icon={rightCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setRightCollapsed(!rightCollapsed)}
                />
              </Space>
            }
            style={{
              width: rightCollapsed ? 48 : 280,
              minWidth: rightCollapsed ? 48 : 280,
              transition: 'width 0.3s, min-width 0.3s',
              overflow: 'hidden',
              background: isDark ? '#1f1f1f' : '#fff',
              flexShrink: 0,
            }}
            styles={{ body: { display: rightCollapsed ? 'none' : 'block' } }}
          >
            {!rightCollapsed && (
              <>
                {!responseMeta && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: isDark ? '#666' : '#999' }}>
                    <ThunderboltOutlined style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }} />
                    <br />
                    <Text type="secondary" style={{ color: isDark ? '#999' : undefined }}>发送消息后显示</Text>
                  </div>
                )}

                {responseMeta && (
                  <>
                    {/* Token Usage */}
                    <div style={{ marginBottom: 20 }}>
                      <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>
                        <CaretRightOutlined /> Token 用量
                      </Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <StatRow label="输入" value={responseMeta.promptTokens.toLocaleString()} />
                        <StatRow label="输出" value={responseMeta.completionTokens.toLocaleString()} />
                        <Divider style={{ margin: '4px 0' }} />
                        <StatRow
                          label="总计"
                          value={responseMeta.totalTokens.toLocaleString()}
                          bold
                        />
                      </div>
                    </div>

                    <Divider style={{ margin: '12px 0' }} />

                    {/* Response Time */}
                    <div style={{ marginBottom: 20 }}>
                      <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        响应时间
                      </Text>
                      <div style={{ fontSize: 24, fontWeight: 600, color: '#1677ff' }}>
                        {formatMs(responseMeta.responseTimeMs)}
                      </div>
                    </div>

                    <Divider style={{ margin: '12px 0' }} />

                    {/* Model Info */}
                    <div style={{ marginBottom: 20 }}>
                      <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>
                        <RobotOutlined style={{ marginRight: 4 }} />
                        当前模型
                      </Text>
                      <div style={{ marginBottom: 8 }}>
                        <Text strong>{selectedModel?.display_name || responseMeta.model}</Text>
                      </div>
                      {selectedModel?.capabilities && selectedModel.capabilities.length > 0 && (
                        <Space size={4} wrap>
                          {selectedModel.capabilities.map((cap: string) => (
                            <Tag key={cap} color="blue">
                              {cap}
                            </Tag>
                          ))}
                        </Space>
                      )}
                      {selectedModel && (
                        <div style={{ marginTop: 12 }}>
                          <StatRow label="类型" value={selectedModel.type ?? '-'} />
                          <StatRow
                            label="上下文窗口"
                            value={selectedModel.context_window ? selectedModel.context_window.toLocaleString() : '-'}
                          />
                          <StatRow
                            label="最大输出"
                            value={selectedModel.max_output_tokens ? selectedModel.max_output_tokens.toLocaleString() : '-'}
                          />
                        </div>
                      )}
                    </div>

                    {responseMeta && (
                      <>
                        <Divider style={{ margin: '12px 0' }} />
                        <Button block icon={<CopyOutlined />} onClick={handleCopyResponse}>
                          复制回复内容
                        </Button>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </Card>
        )}
      </div>

      {/* Prompt Template Modal */}
      <Modal
        title="📋 提示词模板"
        open={templateModalOpen}
        onCancel={() => { setTemplateModalOpen(false); setSelectedTemplate(null); setTemplateVariableInputs({}) }}
        footer={null}
        width={700}
      >
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <Input
            placeholder="搜索模板..."
            prefix={<SearchOutlined />}
            value={templateKeyword}
            onChange={(e) => setTemplateKeyword(e.target.value)}
            allowClear
          />
          <Space size={4} wrap>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <Tag
                key={cat.key}
                color={templateCategory === cat.key ? 'blue' : undefined}
                style={{ cursor: 'pointer' }}
                onClick={() => setTemplateCategory(cat.key)}
              >
                {cat.label}
              </Tag>
            ))}
          </Space>
        </Space>

        {templatesLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无模板</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, maxHeight: 400, overflow: 'auto' }}>
            {templates.map((tpl) => (
              <Card
                key={tpl.id}
                size="small"
                hoverable
                style={{
                  border: selectedTemplate?.id === tpl.id ? '2px solid #1677ff' : undefined,
                }}
                onClick={() => { setSelectedTemplate(tpl); setTemplateVariableInputs({}) }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 13 }}>{tpl.name}</Text>
                  <Tag color="blue" style={{ fontSize: 10 }}>{TEMPLATE_CATEGORIES.find(c => c.key === tpl.category)?.label || tpl.category}</Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.4, maxHeight: 60, overflow: 'hidden' }}>
                  {tpl.content.split('\n').find((line: string) => !line.startsWith('{{'))?.substring(0, 80) || tpl.content.substring(0, 80)}...
                </Text>
                <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>
                  使用 {tpl.usage_count} 次
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Variable Inputs */}
        {selectedTemplate && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: isDark ? '#1a1a1a' : '#fafafa', borderRadius: 8 }}>
            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>模板: {selectedTemplate.name}</Text>
            <div style={{ marginBottom: 12, whiteSpace: 'pre-wrap', fontSize: 12, color: isDark ? '#bbb' : '#555', maxHeight: 150, overflow: 'auto', background: isDark ? '#2a2a2a' : '#f5f5f5', padding: 8, borderRadius: 6 }}>
              {selectedTemplate.content.split(/(\{\{[\w]+\}\})/g).map((part, i) => {
                if (part.match(/^\{\{(\w+)\}\}$/)) {
                  return (
                    <span key={i} style={{ color: '#fa8c16', fontWeight: 600, background: 'rgba(250,140,22,0.15)', padding: '1px 4px', borderRadius: 3 }}>
                      {part}
                    </span>
                  )
                }
                return <span key={i}>{part}</span>
              })}
            </div>
            {selectedTemplate.variables && selectedTemplate.variables.split(',').map((v) => v.trim()).filter(Boolean).map((varName) => (
              <div key={varName} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>{varName}</Text>
                <Input
                  size="small"
                  placeholder={`输入 ${varName}`}
                  value={templateVariableInputs[varName] || ''}
                  onChange={(e) => setTemplateVariableInputs((prev) => ({ ...prev, [varName]: e.target.value }))}
                />
              </div>
            ))}
            <Button
              type="primary"
              size="small"
              block
              onClick={() => {
                let filledContent = selectedTemplate.content
                // Replace {{variable}} with actual values
                const matchRegex = /\{\{(\w+)\}\}/g
                let match
                while ((match = matchRegex.exec(selectedTemplate.content)) !== null) {
                  const varName = match[1]
                  const value = templateVariableInputs[varName] || `{{${varName}}}`
                  filledContent = filledContent.replace(match[0], value)
                }
                if (templateTarget === 'A') {
                  setParams((p) => ({ ...p, systemPrompt: filledContent }))
                } else {
                  setModelBSystemPrompt(filledContent)
                }
                useTemplateMutation.mutate(selectedTemplate.id)
                setTemplateModalOpen(false)
                setSelectedTemplate(null)
                setTemplateVariableInputs({})
              }}
            >
              使用模板 ({templateTarget === 'A' ? '模型 A' : '模型 B'})
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}

// ── Sub-components ──

function StatRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string | number
  bold?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text strong={bold} style={{ fontSize: 12 }}>
        {value}
      </Text>
    </div>
  )
}

// ── Prompt Template Modal (used inside Playground component) ──

const TEMPLATE_CATEGORIES = [
  { key: '', label: '全部' },
  { key: 'coding', label: '编程' },
  { key: 'writing', label: '写作' },
  { key: 'analysis', label: '分析' },
  { key: 'creative', label: '创意' },
  { key: 'business', label: '商务' },
]

// Note: Template modal is rendered inline in the Playground component
// below the main layout. See the template-related states and queries.
