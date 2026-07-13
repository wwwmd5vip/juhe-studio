/**
 * Registry-side model capability helpers.
 * Keep this in sync with the shared capability resolver.
 */

import type { ModelCapability } from '../schemas/enums'
import { normalizeModelId } from './normalize'

const IMAGE_MODEL_RE =
  /dall-e|gpt-image|grok.*image|grok-imagine|ideogram|flux|midjourney|cogview|stable-diffusion|stable-image|imagen|recraft|playground|seedream|kolors|jimeng|wan.*t2i|z-image|nova-canvas|qwen-image|hunyuan.*image|kling.*image|pixai|.*-image$|^image-/i

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
  'web-search': 'websearch'
}

export function inferModelCapabilities(
  modelId: string,
  type?: string | null,
  capabilities?: string[] | null
): ModelCapability[] {
  const normalizedId = normalizeModelId(modelId).toLowerCase()
  const caps = new Set<ModelCapability>()

  caps.add('chat')

  if (REASONING_MODEL_RE.test(normalizedId)) caps.add('reasoning')
  if (VISION_MODEL_RE.test(normalizedId)) caps.add('vision')
  if (IMAGE_MODEL_RE.test(normalizedId)) caps.add('image')
  if (
    /sora|kling|luma|runway|pika|cogvideo|minimax|veo|seedance|wan.*t2v|wan.*i2v|vidu|happyhorse|jimeng/i.test(
      normalizedId
    )
  )
    caps.add('video')
  if (/embed|embedding|bge|text-embedding/i.test(normalizedId)) caps.add('embedding')
  if (/gpt-4|gpt-3\.5-turbo|claude-3|gemini-1\.5|gemini-2|qwen|deepseek|kimi|glm-4|glm-5|llama-3/i.test(normalizedId)) {
    caps.add('function_calling')
  }
  if (/gpt-4o-search|gemini.*search|perplexity|sonar|kimi.*search|glm.*search/i.test(normalizedId))
    caps.add('websearch')
  if (/free|:free|flash-lite|glm-4-flash/i.test(normalizedId)) caps.add('free')

  for (const cap of capabilities ?? []) {
    const mapped = CAPABILITY_ALIASES[cap]
    if (mapped) caps.add(mapped)
  }

  const normalizedType = type?.toLowerCase()
  if (normalizedType === 'image') caps.add('image')
  if (normalizedType === 'video') caps.add('video')

  return Array.from(caps)
}

export function modelSupportsCapability(
  modelId: string,
  required: 'chat' | 'vision' | 'image' | 'video' | 'embedding' | 'function_calling' | 'websearch' | 'reasoning',
  type?: string | null,
  capabilities?: string[] | null
): boolean {
  return inferModelCapabilities(modelId, type, capabilities).includes(required)
}
