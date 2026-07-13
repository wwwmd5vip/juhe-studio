/**
 * Shared model capability helpers.
 * Keep this implementation local to avoid renderer package resolution issues.
 */

import type { ModelCapability } from '@shared/types/provider'

const IMAGE_MODEL_RE =
  /dall-e|gpt-image|grok.*image|grok-imagine|image-generation|image-recognition|ideogram|flux|midjourney|cogview|stable-diffusion|stable-image|imagen|recraft|playground|seedream|kolors|jimeng|wan.*t2i|z-image|nova-canvas|qwen-image|hunyuan.*image|kling.*image|pixai|juhe-nano|juhe-gpt-image|.*-image$|^image-/i

const VISION_MODEL_RE = /vision|vl|gpt-4o|claude-3|gemini-1\.5|gemini-2|qwen2\.5-vl|qvq|kimi-k1\.5|glm-4v|llava/i
const REASONING_MODEL_RE =
  /-r1$|-reasoner|thinking|(^|[^a-z0-9])o1|o3|o4|qwq|kimi-k1\.5|deepseek-r1|claude-3\.7-sonnet-thinking/i

const CAPABILITY_ALIASES: Record<string, ModelCapability> = {
  'function-call': 'function_calling',
  reasoning: 'reasoning',
  'image-recognition': 'vision',
  'image-generation': 'image',
  'audio-recognition': 'audio',
  'audio-generation': 'audio',
  'audio-transcript': 'audio',
  embedding: 'embedding',
  'video-recognition': 'video',
  'video-generation': 'video',
  'web-search': 'websearch',
  // Direct ModelCapability values (self-aliases)
  chat: 'chat',
  vision: 'vision',
  image: 'image',
  video: 'video',
  audio: 'audio',
  websearch: 'websearch',
  function_calling: 'function_calling',
  free: 'free'
}

export interface ModelCapabilitySource {
  name: string
  type?: string | null
  capabilities?: string[] | null
  imageGeneration?: unknown
}

export function inferCapabilities(modelId: string): ModelCapability[] {
  return resolveModelCapabilities({ name: modelId })
}

export function resolveModelCapabilities(model: ModelCapabilitySource): ModelCapability[] {
  const id = model.name.toLowerCase()
  const caps = new Set<ModelCapability>()

  // Only add chat if model is not explicitly a non-chat type
  const nonChatTypes = new Set(['image', 'video', 'embedding', 'audio'])
  const hasNonChatType = model.type != null && nonChatTypes.has(model.type.toLowerCase())
  if (!hasNonChatType) {
    caps.add('chat')
  }

  if (REASONING_MODEL_RE.test(id)) caps.add('reasoning')
  if (VISION_MODEL_RE.test(id)) caps.add('vision')
  if (IMAGE_MODEL_RE.test(id)) caps.add('image')
  if (/sora|kling|luma|runway|pika|cogvideo|minimax|veo|seedance|wan.*t2v|wan.*i2v|vidu|happyhorse|jimeng/i.test(id))
    caps.add('video')
  if (/embed|embedding|bge|text-embedding/i.test(id)) caps.add('embedding')
  if (/gpt-4|gpt-3\.5-turbo|claude-3|gemini-1\.5|gemini-2|qwen|deepseek|kimi|glm-4|glm-5|llama-3/i.test(id)) {
    caps.add('function_calling')
  }
  if (/gpt-4o-search|gemini.*search|perplexity|sonar|kimi.*search|glm.*search/i.test(id)) caps.add('websearch')
  if (/free|:free|flash-lite|glm-4-flash/i.test(id)) caps.add('free')

  for (const cap of model.capabilities ?? []) {
    const mapped = CAPABILITY_ALIASES[cap]
    if (mapped) caps.add(mapped)
  }

  if (model.imageGeneration) caps.add('image')

  const normalizedType = model.type?.toLowerCase()
  if (normalizedType === 'image') caps.add('image')
  if (normalizedType === 'video') caps.add('video')

  return Array.from(caps)
}

const MODE_TO_CAPABILITY: Record<'image' | 'video' | 'audio' | 'text', ModelCapability> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  text: 'chat'
}

/** 根据模型能力列表判断其是否支持指定的生成模式 */
export function modelHasCapabilityForMode(
  capabilities: string[] | undefined,
  mode: 'image' | 'video' | 'audio' | 'text'
): boolean {
  return (capabilities ?? []).includes(MODE_TO_CAPABILITY[mode])
}
