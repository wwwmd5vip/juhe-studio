import type { AspectRatio, Platform } from './enums'

export const DEFAULT_ASPECT_RATIOS: Record<Platform, AspectRatio> = {
  taobao: '3:4',
  jd: '3:4',
  pinduoduo: '3:4',
  '1688': '3:4',
  temu: '1:1',
  tiktok: '9:16',
  xiaohongshu: '9:16',
  douyin: '9:16',
  amazon: '1:1',
  aliexpress: '1:1',
  ebay: '1:1',
  ozon: '1:1',
  shopee: '1:1',
  alibaba_intl: '1:1',
  independent: '1:1'
}

export function getDefaultAspectRatio(platform: Platform | undefined): AspectRatio {
  if (!platform) return '1:1'
  return DEFAULT_ASPECT_RATIOS[platform] ?? '1:1'
}
