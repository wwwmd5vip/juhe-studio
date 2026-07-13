import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './locales/zh-CN.json'

// Track which locales have been loaded to avoid redundant imports
const loadedLocales = new Set<string>(['zh-CN'])

// Lazy-load non-default locales on demand
async function loadLocale(lng: string): Promise<Record<string, unknown> | null> {
  if (loadedLocales.has(lng)) return null
  switch (lng) {
    case 'en': {
      const mod = await import('./locales/en.json')
      loadedLocales.add(lng)
      return mod.default as Record<string, unknown>
    }
    default:
      return null
  }
}

// Only bundle the default locale (zh-CN, ~97KB) upfront.
// Other locales (~99KB each) are loaded on first switch.
const resources = {
  'zh-CN': { translation: zhCN }
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  nsSeparator: false,
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  },
  partialBundledLanguages: true
})

// Patch changeLanguage to lazy-load locale resources before switching
const originalChangeLanguage = i18n.changeLanguage.bind(i18n)
i18n.changeLanguage = async function (lng?: string) {
  if (lng && !loadedLocales.has(lng)) {
    const translations = await loadLocale(lng)
    if (translations) {
      i18n.addResourceBundle(lng, 'translation', translations, true, true)
    }
  }
  return originalChangeLanguage(lng)
} as unknown as typeof i18n.changeLanguage

export default i18n
