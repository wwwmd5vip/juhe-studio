const HUMAN_SCENE_RE =
  /\b(woman|women|man|men|girl|boy|person|people|model|face|faces|body|bodies|leg|legs|foot|feet|wearing|wears|walking|walking\s+in|try-?on|on\s+feet|footwear\s+on\s+feet|cafe|café|coffee\s*shop|street|sidewalk)\b|女性|男性|女人|男人|女孩|男孩|真人|人物|人像|模特|用户|脸|面部|身体|腿|脚|脚部|穿着|脚穿|试穿|走路|行走|咖啡厅|街边|咖啡馆|街道|街头/i

const PRODUCT_ONLY_FALLBACK = [
  'Standalone product commercial shot',
  'Product placed on a clean tabletop, display stand, or neutral background',
  'Emphasize materials, shape, texture, and commercial clarity',
  'No people, no bodies, no faces, no hands, no feet, no try-on, no lifestyle model',
  'High clarity, commercially usable, product-only'
].join('\n')

export interface ProductOnlyPromptOptions {
  platformStyle?: {
    visualKeywords: string
    compositionHint: string
    colorTone: string
  }
}

export function isHumanScenePrompt(prompt: string): boolean {
  return HUMAN_SCENE_RE.test(prompt)
}

export function sanitizeImagePrompt(prompt: string, options: ProductOnlyPromptOptions = {}): string {
  const trimmed = prompt.trim()
  if (!trimmed) return ''
  if (!isHumanScenePrompt(trimmed)) return trimmed

  if (!options.platformStyle) return PRODUCT_ONLY_FALLBACK

  return [
    PRODUCT_ONLY_FALLBACK,
    `Platform style: ${options.platformStyle.visualKeywords}`,
    `Composition: ${options.platformStyle.compositionHint}`,
    `Color tone: ${options.platformStyle.colorTone}`
  ].join('\n')
}

export function buildProductOnlyPrompt(prompt: string, options: ProductOnlyPromptOptions = {}): string {
  return sanitizeImagePrompt(prompt, options)
}
