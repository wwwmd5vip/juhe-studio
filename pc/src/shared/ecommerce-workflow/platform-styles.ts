import type { Platform } from './enums'

export interface PlatformStyle {
  visualKeywords: string
  compositionHint: string
  colorTone: string
  doNotInclude: string
}

export const PLATFORM_STYLES: Record<Platform, PlatformStyle> = {
  amazon: {
    visualKeywords: 'clean white background, professional product photography, high-key lighting',
    compositionHint: 'product centered, ample negative space, minimal props',
    colorTone: 'neutral, bright',
    doNotInclude: 'text overlays, watermarks, decorative frames'
  },
  taobao: {
    visualKeywords: 'vibrant lifestyle scene, model or hand interaction, warm tones',
    compositionHint: 'dynamic angle, contextual props, emotional appeal',
    colorTone: 'warm, saturated',
    doNotInclude: 'overly plain background'
  },
  temu: {
    visualKeywords: 'bold colors, discount-friendly, eye-catching',
    compositionHint: 'product hero shot with price-friendly layout',
    colorTone: 'high contrast',
    doNotInclude: 'luxury styling'
  },
  tiktok: {
    visualKeywords: 'trendy, short-video friendly, energetic',
    compositionHint: 'vertical 9:16, dynamic pose',
    colorTone: 'vivid',
    doNotInclude: 'static catalog look'
  },
  pinduoduo: {
    visualKeywords: 'group-buy feeling, bright, price-sensitive',
    compositionHint: 'clear product with offer cues',
    colorTone: 'bright red/white',
    doNotInclude: 'minimalist luxury'
  },
  douyin: {
    visualKeywords: 'trendy, young, lifestyle',
    compositionHint: 'vertical, model-in-context',
    colorTone: 'vivid',
    doNotInclude: 'boring studio shots'
  },
  ozon: {
    visualKeywords: 'clean, trustworthy, cold climate ready',
    compositionHint: 'plain background, clear labels',
    colorTone: 'cool neutral',
    doNotInclude: 'cluttered scenes'
  },
  independent: {
    visualKeywords: 'brand-centric, premium, consistent identity',
    compositionHint: 'follow brand guidelines',
    colorTone: 'brand-defined',
    doNotInclude: 'platform-specific overlays'
  },
  shopee: {
    visualKeywords: 'southeast asia lifestyle, friendly, colorful',
    compositionHint: 'contextual usage, bright background',
    colorTone: 'warm',
    doNotInclude: 'dark moody'
  },
  alibaba_intl: {
    visualKeywords: 'B2B wholesale, factory-ready, clear specs',
    compositionHint: 'product with scale/context, plain background',
    colorTone: 'neutral',
    doNotInclude: 'consumer lifestyle clutter'
  },
  aliexpress: {
    visualKeywords: 'global shipping friendly, clear, value',
    compositionHint: 'product on neutral background with size reference',
    colorTone: 'bright',
    doNotInclude: 'local festival-only themes'
  },
  jd: {
    visualKeywords: 'trusted retail, clean, quality assurance',
    compositionHint: 'white background, product detail focus',
    colorTone: 'clean white',
    doNotInclude: 'excessive decoration'
  },
  '1688': {
    visualKeywords: 'wholesale, bulk, factory direct',
    compositionHint: 'product stack or factory context',
    colorTone: 'neutral',
    doNotInclude: 'premium lifestyle props'
  },
  xiaohongshu: {
    visualKeywords: 'lifestyle seeding, authentic daily scene, soft bright lighting, 9:16 vertical',
    compositionHint: 'vertical 9:16, natural context, warm emotional appeal',
    colorTone: 'soft, bright, warm',
    doNotInclude: 'hard sell text overlays, cluttered studio background'
  },
  ebay: {
    visualKeywords: 'clean white background, professional product detail, trust badge friendly',
    compositionHint: '1:1 square, product centered, clear detail focus',
    colorTone: 'neutral, clean',
    doNotInclude: 'decorative frames, watermarks, lifestyle clutter'
  }
}
