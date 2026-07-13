/**
 * Provider mapping constants.
 *
 * Maps endpoint types to internal provider identifiers, provides sensible
 * default models for each preset provider, and maintains curated sets of
 * Aliyun image/video model identifiers.
 */

/**
 * Maps an endpoint type identifier to the internal provider type used
 * throughout the application.
 */
export const ENDPOINT_TO_PROVIDER: Record<string, string> = {
  'openai-chat-completions': 'openai-compatible',
  'openai-responses': 'openai',
  'anthropic-messages': 'anthropic',
  'google-generate-content': 'google',
  'ollama-chat': 'ollama',
  'openai-image-generation': 'openai-compatible'
}

/**
 * Returns the internal provider type for the given endpoint/provider type.
 * Falls back to the input value, or `'openai-compatible'` when falsy.
 *
 * @param providerType - The endpoint or provider type identifier to resolve.
 * @returns The resolved internal provider type.
 */
export function mapProviderType(providerType: string): string {
  return ENDPOINT_TO_PROVIDER[providerType] || providerType || 'openai-compatible'
}

/**
 * Default model identifier to use for each preset provider.
 */
export const DEFAULT_MODELS_BY_PRESET: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  google: 'gemini-1.5-flash',
  deepseek: 'deepseek-chat',
  openrouter: 'openai/gpt-4o-mini',
  siliconflow: 'Qwen/Qwen2.5-7B-Instruct',
  moonshot: 'moonshot-v1-8k',
  zhipu: 'glm-4-flash',
  ollama: 'llama3.2',
  nvidia: 'meta/llama-3.1-8b-instruct',
  volcengine: 'doubao-pro-32k',
  aliyun: 'qwen-plus'
}

/**
 * Default test model identifier keyed by the preset display name.
 */
export const DEFAULT_TEST_MODELS_BY_NAME: Record<string, string> = {
  OpenAI: 'gpt-4o-mini',
  Anthropic: 'claude-3-5-haiku-20241022',
  'Google Gemini': 'gemini-1.5-flash',
  DeepSeek: 'deepseek-chat',
  OpenRouter: 'openai/gpt-4o-mini',
  SiliconFlow: 'Qwen/Qwen2.5-7B-Instruct',
  'Moonshot (月之暗面)': 'moonshot-v1-8k',
  '智谱 AI': 'glm-4-flash',
  Ollama: 'llama3.2',
  'Volcengine (火山引擎)': 'doubao-pro-32k',
  'Aliyun (阿里云百炼)': 'qwen-plus'
}

/**
 * Set of Aliyun image generation model identifiers.
 */
export const ALIYUN_IMAGE_MODELS: Set<string> = new Set([
  'wan2.6-t2i',
  'wan2.5-t2i-preview',
  'wan2.2-t2i-flash',
  'wan2.2-t2i-plus',
  'wanx2.1-t2i-turbo',
  'wanx2.1-t2i-plus',
  'wanx2.0-t2i-turbo',
  'z-image-turbo',
  'kling/kling-v3-image-generation',
  'kling/kling-v3-omni-image-generation'
])

/**
 * Set of Aliyun video generation model identifiers.
 */
export const ALIYUN_VIDEO_MODELS: Set<string> = new Set([
  'wan2.7-t2v',
  'wan2.7-i2v-2026-04-25',
  'vidu/viduq3-pro_text2video',
  'vidu/viduq3-turbo_text2video',
  'vidu/viduq2_text2video',
  'happyhorse-1.0-t2v',
  'happyhorse-1.0-r2v'
])
