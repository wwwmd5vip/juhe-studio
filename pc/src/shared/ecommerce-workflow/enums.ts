export const PLATFORMS = [
  'amazon',
  'taobao',
  '1688',
  'temu',
  'tiktok',
  'pinduoduo',
  'douyin',
  'ozon',
  'independent',
  'shopee',
  'alibaba_intl',
  'aliexpress',
  'jd',
  'xiaohongshu',
  'ebay'
] as const
export type Platform = (typeof PLATFORMS)[number]

export const MARKETS = ['us', 'eu', 'cn', 'ru', 'sea', 'es', 'de', 'jp', 'br'] as const
export type Market = (typeof MARKETS)[number]

export const LANGUAGES = [
  'en',
  'zh',
  'zh-TW',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'pt',
  'ar',
  'ru',
  'it',
  'th',
  'vi'
] as const
export type Language = (typeof LANGUAGES)[number]

export const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const
export type AspectRatio = (typeof ASPECT_RATIOS)[number]
