/**
 * Provider 预设配置
 * 内置主流 AI 服务商的配置模板
 */

import type { ProviderPreset } from '@shared/types/provider'

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI GPT 系列模型',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs',
    modelsUrl: 'https://platform.openai.com/docs/models',
    supportsModelList: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 系列模型',
    type: 'anthropic-messages',
    defaultBaseUrl: 'https://api.anthropic.com',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com',
    modelsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
    supportsModelList: false
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 系列模型',
    type: 'google-generate-content',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    modelsUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini',
    supportsModelList: true
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek Chat / Reasoner',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    docsUrl: 'https://api-docs.deepseek.com',
    supportsModelList: true
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '统一的模型路由平台',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyUrl: 'https://openrouter.ai/keys',
    docsUrl: 'https://openrouter.ai/docs',
    modelsUrl: 'https://openrouter.ai/docs#models',
    supportsModelList: true
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    description: '硅基流动，国内模型聚合',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
    docsUrl: 'https://docs.siliconflow.cn',
    supportsModelList: true
  },
  {
    id: 'moonshot',
    name: 'Moonshot (月之暗面)',
    description: 'Kimi 系列模型',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    docsUrl: 'https://platform.moonshot.cn/docs',
    supportsModelList: true
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    description: 'GLM / CogView 系列',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyUrl: 'https://bigmodel.cn/usercenter/apikeys',
    docsUrl: 'https://open.bigmodel.cn/dev/howuse/glm-4',
    supportsModelList: true
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: '本地运行开源模型',
    type: 'ollama-chat',
    defaultBaseUrl: 'http://localhost:11434',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/api.md',
    supportsModelList: true
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    description: 'NVIDIA NIM 模型服务',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKeyUrl: 'https://build.nvidia.com/meta/llama-3_1-405b-instruct',
    docsUrl: 'https://docs.api.nvidia.com/nim/reference/llm-apis',
    modelsUrl: 'https://build.nvidia.com/nim',
    supportsModelList: true
  },
  {
    id: 'volcengine',
    name: 'Volcengine (火山引擎)',
    description: '字节跳动火山引擎 Ark 大模型 API',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyUrl: 'https://console.volcengine.com/iam/keymanage',
    docsUrl: 'https://www.volcengine.com/docs/82379',
    modelsUrl: 'https://www.volcengine.com/docs/82379/1263482',
    supportsModelList: true,
    authType: 'dualKey'
  },
  {
    id: 'jimeng',
    name: 'Jimeng (即梦)',
    description: '即梦 AI 图像/视频生成 (通过火山引擎视觉 API)',
    type: 'openai-image-generation',
    defaultBaseUrl: 'https://visual.volcengineapi.com',
    apiKeyUrl: 'https://console.volcengine.com/iam/keymanage',
    docsUrl: 'https://www.volcengine.com/docs/6791',
    supportsModelList: false,
    authType: 'dualKey',
    defaultModels: [
      // 图片生成
      { name: 'jimeng-t2i-v40', displayName: '图片生成 4.0', capabilities: ['image'] },
      { name: 'jimeng-t2i-v31', displayName: '图片生成 3.1', capabilities: ['image'] },
      { name: 'jimeng-t2i-v30', displayName: '图片生成 3.0', capabilities: ['image'] },
      { name: 'jimeng-i2i-v30', displayName: '图生图 3.0', capabilities: ['image'] },
      { name: 'jimeng-seedream46-cvtob', displayName: '图片生成 4.6', capabilities: ['image'] },
      // 图片编辑
      { name: 'jimeng-outpainting', displayName: '智能扩图', capabilities: ['image'] },
      { name: 'jimeng-super-resolution', displayName: '智能超清', capabilities: ['image'] },
      { name: 'jimeng-inpainting', displayName: '交互编辑', capabilities: ['image'] },
      // 素材提取
      { name: 'jimeng-extract-product', displayName: '提取商品主体', capabilities: ['image'] },
      { name: 'jimeng-extract-pod', displayName: '提取 POD 素材', capabilities: ['image'] },
      // 视频生成
      { name: 'jimeng-t2v-v30-pro', displayName: '视频生成 3.0 Pro', capabilities: ['video'] },
      { name: 'jimeng-t2v-v30-720p', displayName: '视频生成 3.0 (720P)', capabilities: ['video'] },
      { name: 'jimeng-t2v-v30-1080p', displayName: '视频生成 3.0 (1080P)', capabilities: ['video'] },
      // 图生视频
      { name: 'jimeng-i2v-first-v30-720p', displayName: '图生视频 3.0 (720P)', capabilities: ['video'] },
      { name: 'jimeng-i2v-first-v30-1080p', displayName: '图生视频 3.0 (1080P)', capabilities: ['video'] },
      { name: 'jimeng-i2v-first-tail-v30-720p', displayName: '首尾帧视频 3.0 (720P)', capabilities: ['video'] },
      { name: 'jimeng-i2v-first-tail-v30-1080p', displayName: '首尾帧视频 3.0 (1080P)', capabilities: ['video'] },
      { name: 'jimeng-i2v-recamera-v30-720p', displayName: '视频运镜 3.0 (720P)', capabilities: ['video'] },
      { name: 'jimeng-i2v-recamera-v30-1080p', displayName: '视频运镜 3.0 (1080P)', capabilities: ['video'] },
      { name: 'jimeng-i2v-s2-pro', displayName: '图生视频 S2 Pro', capabilities: ['video'] },
      // 动作模仿
      { name: 'jimeng-dream-actor', displayName: '动作模仿 M1', capabilities: ['video'] },
      { name: 'jimeng-dream-actor-v2', displayName: '动作模仿 M2', capabilities: ['video'] },
      // 小云雀
      { name: 'jimeng-pippit-marketing', displayName: '小云雀营销视频', capabilities: ['video'] },
      { name: 'jimeng-pippit-video-v2', displayName: '小云雀视频 V2', capabilities: ['video'] },
      { name: 'jimeng-pippit-video-v2-with-ref', displayName: '小云雀视频 V2 (参考视频)', capabilities: ['video'] }
    ]
  },
  {
    id: 'aliyun',
    name: 'Aliyun (阿里云百炼)',
    description: '阿里云百炼 DashScope 大模型 API (OpenAI 兼容)',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyUrl: 'https://bailian.console.aliyun.com/?tab=model#/api-key',
    docsUrl: 'https://help.aliyun.com/zh/model-studio/developer-reference',
    modelsUrl: 'https://help.aliyun.com/zh/model-studio/model-pricing',
    supportsModelList: true
  },
  {
    id: 'custom-openai',
    name: 'Custom (OpenAI Compatible)',
    description: '兼容 OpenAI API 格式的自定义服务商',
    type: 'openai-chat-completions',
    defaultBaseUrl: 'https://api.example.com/v1',
    supportsModelList: true
  }
]

/** 按 ID 查找预设 */
export function getPresetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id)
}

/** 按 endpoint type 查找预设 */
export function getPresetsByType(type: string): ProviderPreset[] {
  return PROVIDER_PRESETS.filter((p) => p.type === type)
}

/** 按 base URL 查找最匹配的预设（用于修复旧数据缺失 presetId） */
export function getPresetByBaseUrl(baseUrl: string | null): ProviderPreset | undefined {
  if (!baseUrl) return undefined
  const normalized = baseUrl.toLowerCase().replace(/\/$/, '')

  // 1. Exact or prefix match on full URL
  const exact = PROVIDER_PRESETS.find((p) => {
    const presetUrl = p.defaultBaseUrl.toLowerCase().replace(/\/$/, '')
    return normalized === presetUrl || normalized.startsWith(`${presetUrl}/`)
  })
  if (exact) return exact

  // 2. Hostname + path subsequence match for providers with intermediate paths
  // e.g. https://open.bigmodel.cn/api/coding/paas/v4 -> matches zhipu (open.bigmodel.cn ... /paas/v4)
  try {
    const url = new URL(normalized)
    const host = url.hostname.toLowerCase()
    const segments = url.pathname
      .toLowerCase()
      .split('/')
      .filter((s) => s.length > 0)

    return PROVIDER_PRESETS.find((p) => {
      const presetUrl = p.defaultBaseUrl.toLowerCase().replace(/\/$/, '')
      const presetHost = new URL(presetUrl).hostname.toLowerCase()
      if (host !== presetHost) return false
      const presetSegments = new URL(presetUrl).pathname
        .toLowerCase()
        .split('/')
        .filter((s) => s.length > 0)
      if (presetSegments.length === 0) return true
      // Check if all preset segments appear in order within the provider path
      let idx = 0
      for (const seg of segments) {
        if (seg === presetSegments[idx]) {
          idx++
          if (idx === presetSegments.length) return true
        }
      }
      return false
    })
  } catch {
    return undefined
  }
}
