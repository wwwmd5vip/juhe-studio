import type { Language, Market } from './enums'

export const MARKET_TONE: Record<Market, { temperature: 'warm' | 'cold'; examples: string }> = {
  us: { temperature: 'warm', examples: 'lifestyle-driven' },
  eu: { temperature: 'cold', examples: 'minimalist, eco-conscious' },
  cn: { temperature: 'warm', examples: 'festive, detail-rich' },
  ru: { temperature: 'cold', examples: 'straightforward, durable-focused' },
  sea: { temperature: 'warm', examples: 'friendly, community-oriented' },
  es: { temperature: 'warm', examples: 'family-oriented, warm' },
  de: { temperature: 'cold', examples: 'precise, quality-focused' },
  jp: { temperature: 'cold', examples: 'minimalist, craftsmanship' },
  br: { temperature: 'warm', examples: 'vibrant, social' }
}

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  zh: '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  ar: 'العربية',
  ru: 'Русский',
  it: 'Italiano',
  th: 'ไทย',
  vi: 'Tiếng Việt'
}
