/**
 * 渠道类型品牌色映射
 * 参考 CLIProxyAPI、sub2api-cnb 的 PlatformIcon/PlatformBadge 模式
 */
export interface ChannelColor {
  color: string
  bg: string
  border: string
}

export const CHANNEL_COLORS: Record<string, ChannelColor> = {
  openai: { color: '#10a37f', bg: '#10a37f18', border: '#10a37f40' },
  'openai-compatible': { color: '#10a37f', bg: '#10a37f18', border: '#10a37f40' },
  anthropic: { color: '#d97757', bg: '#d9775718', border: '#d9775740' },
  gemini: { color: '#4285f4', bg: '#4285f418', border: '#4285f440' },
  deepseek: { color: '#4d6bfe', bg: '#4d6bfe18', border: '#4d6bfe40' },
  siliconflow: { color: '#7c3aed', bg: '#7c3aed18', border: '#7c3aed40' },
  volcengine: { color: '#ff6b35', bg: '#ff6b3518', border: '#ff6b3540' },
  zhipu: { color: '#3859ff', bg: '#3859ff18', border: '#3859ff40' },
  qwen: { color: '#615ced', bg: '#615ced18', border: '#615ced40' },
  moonshot: { color: '#6366f1', bg: '#6366f118', border: '#6366f140' },
  openrouter: { color: '#818cf8', bg: '#818cf818', border: '#818cf840' },
  ollama: { color: '#a3a3a3', bg: '#a3a3a318', border: '#a3a3a340' },
  azure: { color: '#0078d4', bg: '#0078d418', border: '#0078d440' },
  vertex: { color: '#4285f4', bg: '#4285f418', border: '#4285f440' },
  bedrock: { color: '#ff9900', bg: '#ff990018', border: '#ff990040' },
  jimeng: { color: '#f5222d', bg: '#f5222d18', border: '#f5222d40' },
  kling: { color: '#ec4899', bg: '#ec489918', border: '#ec489940' },
  mxapi: { color: '#e74c3c', bg: '#e74c3c18', border: '#e74c3c40' },
  coze: { color: '#3370ff', bg: '#3370ff18', border: '#3370ff40' },
  xai: { color: '#f97316', bg: '#f9731618', border: '#f9731640' },
  custom: { color: '#8c8c8c', bg: '#8c8c8c18', border: '#8c8c8c40' },
}

/** 获取渠道类型颜色，未知类型返回灰色 */
export function getChannelColor(type: string): ChannelColor {
  return CHANNEL_COLORS[type] ?? { color: '#8c8c8c', bg: '#8c8c8c18', border: '#8c8c8c40' }
}

/** 渠道类型显示名映射 */
export const CHANNEL_TYPE_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  'openai-compatible': 'OpenAI Compatible',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  siliconflow: '硅基流动',
  volcengine: '火山引擎',
  zhipu: '智谱',
  qwen: '通义千问',
  moonshot: 'Moonshot',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  azure: 'Azure',
  vertex: 'Vertex AI',
  bedrock: 'Bedrock',
  jimeng: '即梦',
  kling: '可灵',
  mxapi: 'MXAPI',
  coze: '扣子',
  xai: 'xAI',
  custom: '自定义',
}

/** 获取渠道类型短标签 */
export function getChannelLabel(type: string): string {
  return CHANNEL_TYPE_LABELS[type] ?? type
}

/** 定价模式颜色 */
export const BILLING_MODE_COLORS: Record<string, string> = {
  token: '#1890ff',
  fixed: '#52c41a',
  tiered: '#fa8c16',
}
