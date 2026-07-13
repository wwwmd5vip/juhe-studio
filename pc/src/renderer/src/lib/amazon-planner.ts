/**
 * Amazon Planner 核心逻辑
 * 从 amazon-image-studio/listingPlanner.ts 提取，适配桌面端
 */

import { formatAmazonAPlusReferenceMaterial, formatAmazonListingReferenceMaterial } from './amazon-knowledge'

// ===== Types =====

export type AmazonPlannerMode = 'listing' | 'aplus'
export type APlusContentType = 'standard' | 'standard-large' | 'premium' | 'mobile'
export type APlusModuleKind =
  | 'header-banner'
  | 'single-image'
  | 'highlight-tile'
  | 'hero-banner'
  | 'feature-image'
  | 'brand-story'
  | 'logo'
  | 'comparison-thumbnail'
export type AmazonStyleDensityMode = 'rich' | 'minimal'

export interface AmazonAPlusModuleSpec {
  contentType: APlusContentType | 'optional'
  slot: string
  label: string
  displayLabel: string
  moduleType: APlusModuleKind
  uploadWidth: number
  uploadHeight: number
  objective: string
}

export interface AmazonImagePlan {
  slot: string
  label: string
  kind?: string
  planMarkdown: string
  prompt: string
  negativePrompt: string
}

export interface AmazonAPlusPlan {
  slot: string
  label: string
  displayLabel: string
  moduleType: APlusModuleKind
  uploadSize: string
  generationSize: string
  planMarkdown: string
  textTitle: string
  textBody: string
  prompt: string
  negativePrompt: string
}

export interface AmazonPromptDraft {
  productName?: string
  title?: string
  bullets?: string[]
  description?: string
  features?: string[]
  brandName?: string
}

// ===== Constants =====

export const A_PLUS_CONTENT_TYPES: APlusContentType[] = ['standard-large', 'standard', 'premium', 'mobile']
export const MIN_A_PLUS_MODULE_COUNT = 1
export const MAX_A_PLUS_MODULE_COUNT = 12
export const DEFAULT_LISTING_IMAGE_COUNT = 7
export const MIN_LISTING_IMAGE_COUNT = 7
export const MAX_LISTING_IMAGE_COUNT = 12
export const LISTING_IMAGE_COUNT_OPTIONS = Array.from(
  { length: MAX_LISTING_IMAGE_COUNT - MIN_LISTING_IMAGE_COUNT + 1 },
  (_, i) => MIN_LISTING_IMAGE_COUNT + i
)

// ===== A+ Module Specs =====

const clone = (spec: AmazonAPlusModuleSpec): AmazonAPlusModuleSpec => ({ ...spec })

export const STANDARD_A_PLUS_MODULE_SPECS: AmazonAPlusModuleSpec[] = [
  { contentType: 'standard', slot: 'A+S01', label: 'Header Banner', displayLabel: '顶部横幅', moduleType: 'header-banner', uploadWidth: 970, uploadHeight: 300, objective: '用横幅建立品牌质感和核心产品利益点。' },
  ...Array.from({ length: 3 }, (_, i) => ({ contentType: 'standard' as const, slot: `A+S0${i + 2}`, label: `Single Image ${i + 1}`, displayLabel: `大图模块 ${i + 1}`, moduleType: 'single-image' as const, uploadWidth: 970, uploadHeight: 600, objective: '用单图模块讲清一个关键卖点或使用场景。' })),
  ...Array.from({ length: 4 }, (_, i) => ({ contentType: 'standard' as const, slot: `A+S0${i + 5}`, label: `Highlight Tile ${i + 1}`, displayLabel: `卖点方块 ${i + 1}`, moduleType: 'highlight-tile' as const, uploadWidth: 220, uploadHeight: 220, objective: '用方形图块快速呈现一个产品亮点。' })),
]

export const STANDARD_LARGE_A_PLUS_MODULE_SPECS: AmazonAPlusModuleSpec[] = [
  { contentType: 'standard-large', slot: 'A+L01', label: 'Header Banner', displayLabel: '顶部横幅', moduleType: 'header-banner', uploadWidth: 970, uploadHeight: 300, objective: '用横幅建立品牌质感和核心产品利益点。' },
  ...Array.from({ length: 4 }, (_, i) => ({ contentType: 'standard-large' as const, slot: `A+L0${i + 2}`, label: `Single Image ${i + 1}`, displayLabel: `大图模块 ${i + 1}`, moduleType: 'single-image' as const, uploadWidth: 970, uploadHeight: 600, objective: '用整张大图讲清一个关键卖点、使用场景或细节证据。' })),
]

export const PREMIUM_A_PLUS_MODULE_SPECS: AmazonAPlusModuleSpec[] = [
  { contentType: 'premium', slot: 'A+P01', label: 'Hero Banner', displayLabel: '高级首屏横幅', moduleType: 'hero-banner', uploadWidth: 1464, uploadHeight: 600, objective: '用高级横幅建立首屏视觉冲击和品牌氛围。' },
  ...Array.from({ length: 3 }, (_, i) => ({ contentType: 'premium' as const, slot: `A+P0${i + 2}`, label: `Feature Image ${i + 1}`, displayLabel: `高级大图模块 ${i + 1}`, moduleType: 'feature-image' as const, uploadWidth: 970, uploadHeight: 600, objective: '用大图模块展示核心功能、材质或真实场景。' })),
  ...Array.from({ length: 2 }, (_, i) => ({ contentType: 'premium' as const, slot: `A+P0${i + 5}`, label: `Brand Story ${i + 1}`, displayLabel: `品牌故事 ${i + 1}`, moduleType: 'brand-story' as const, uploadWidth: 463, uploadHeight: 625, objective: '用竖版品牌故事模块强化信任和使用想象。' })),
]

export const MOBILE_A_PLUS_MODULE_SPECS: AmazonAPlusModuleSpec[] = [
  { contentType: 'mobile', slot: 'A+M01', label: 'Mobile Hero', displayLabel: '手机首屏', moduleType: 'hero-banner', uploadWidth: 600, uploadHeight: 450, objective: '用移动端首屏图建立产品核心卖点和清晰视觉吸引力。' },
  ...Array.from({ length: 4 }, (_, i) => ({ contentType: 'mobile' as const, slot: `A+M0${i + 2}`, label: `Mobile Feature ${i + 1}`, displayLabel: `手机卖点图 ${i + 1}`, moduleType: 'feature-image' as const, uploadWidth: 600, uploadHeight: 450, objective: '用移动端友好的 4:3 图片讲清一个关键卖点、细节证据或使用场景。' })),
]

// ===== Helper Functions =====

export function normalizeListingImageCount(value: unknown): number {
  const count = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : DEFAULT_LISTING_IMAGE_COUNT
  if (!Number.isFinite(count)) return DEFAULT_LISTING_IMAGE_COUNT
  return Math.min(MAX_LISTING_IMAGE_COUNT, Math.max(MIN_LISTING_IMAGE_COUNT, Math.trunc(count)))
}

export function getAmazonListingImageSlots(count: unknown = DEFAULT_LISTING_IMAGE_COUNT): string[] {
  const n = normalizeListingImageCount(count)
  return ['MAIN', ...Array.from({ length: n - 1 }, (_, i) => `PT${String(i + 1).padStart(2, '0')}`)]
}

export function isAmazonListingMainSlot(slot?: string | null): boolean {
  return slot?.trim().toUpperCase() === 'MAIN'
}

export function getAPlusModuleSpecs(type: APlusContentType): AmazonAPlusModuleSpec[] {
  switch (type) {
    case 'premium': return PREMIUM_A_PLUS_MODULE_SPECS.map(clone)
    case 'mobile': return MOBILE_A_PLUS_MODULE_SPECS.map(clone)
    case 'standard-large': return STANDARD_LARGE_A_PLUS_MODULE_SPECS.map(clone)
    default: return STANDARD_A_PLUS_MODULE_SPECS.map(clone)
  }
}

export function getAPlusContentTypeLabel(type: APlusContentType): string {
  switch (type) {
    case 'premium': return '高级A+'
    case 'mobile': return '手机A+'
    case 'standard-large': return '普通A+'
    default: return '标准A+'
  }
}

const A_PLUS_MODULE_KINDS: APlusModuleKind[] = ['header-banner', 'single-image', 'highlight-tile', 'hero-banner', 'feature-image', 'brand-story', 'logo', 'comparison-thumbnail']

export function normalizeAPlusModuleSpecs(type: APlusContentType, specs?: Array<Partial<AmazonAPlusModuleSpec>> | null): AmazonAPlusModuleSpec[] {
  const fallbackSpecs = getAPlusModuleSpecs(type)
  const source = Array.isArray(specs) && specs.length ? specs : fallbackSpecs
  return source.slice(0, MAX_A_PLUS_MODULE_COUNT).map((spec, i) => {
    const fb = fallbackSpecs[i] ?? fallbackSpecs[0]
    const mt = spec.moduleType && A_PLUS_MODULE_KINDS.includes(spec.moduleType as APlusModuleKind) ? spec.moduleType as APlusModuleKind : fb.moduleType
    return {
      contentType: type,
      slot: `${getSlotPrefix(type)}${String(i + 1).padStart(2, '0')}`,
      label: mt !== spec.moduleType ? fb.label : `${spec.moduleType}-${i + 1}`,
      displayLabel: fb.displayLabel,
      moduleType: mt,
      uploadWidth: spec.uploadWidth ?? fb.uploadWidth,
      uploadHeight: spec.uploadHeight ?? fb.uploadHeight,
      objective: spec.objective ?? fb.objective,
    }
  })
}

function getSlotPrefix(type: APlusContentType): string {
  switch (type) { case 'premium': return 'A+P'; case 'mobile': return 'A+M'; case 'standard-large': return 'A+L'; default: return 'A+S' }
}

export function removeAPlusModuleSpecAt(type: APlusContentType, specs: Array<Partial<AmazonAPlusModuleSpec>>, index: number): AmazonAPlusModuleSpec[] {
  const normalized = normalizeAPlusModuleSpecs(type, specs)
  if (normalized.length <= MIN_A_PLUS_MODULE_COUNT) return normalized
  const idx = Math.min(Math.max(index, 0), normalized.length - 1)
  return normalizeAPlusModuleSpecs(type, normalized.filter((_, i) => i !== idx))
}

export function insertAPlusModuleSpecAfter(type: APlusContentType, specs: Array<Partial<AmazonAPlusModuleSpec>>, index: number): AmazonAPlusModuleSpec[] {
  const normalized = normalizeAPlusModuleSpecs(type, specs)
  if (normalized.length >= MAX_A_PLUS_MODULE_COUNT) return normalized
  const idx = Math.min(Math.max(index, 0), normalized.length - 1)
  const source = normalized[idx]
  const next = [...normalized.slice(0, idx + 1), clone(source), ...normalized.slice(idx + 1)]
  return normalizeAPlusModuleSpecs(type, next)
}

// ===== Prompt Builders =====

export function buildListingPlannerSystemPrompt(): string {
  return [
    'You are a senior Amazon listing image planner. Given product information, generate a detailed image plan for the Amazon listing carousel.',
    '',
    '## Rules:',
    '- The first image is always the MAIN image: pure white background, product fills ~85% of frame, no text/logos/watermarks.',
    '- Remaining images are secondary (PT01, PT02, ...): lifestyle, detail, scale, comparison, use-scenes.',
    '- Each image must serve a clear commercial purpose that matches the product title and bullets.',
    '- Avoid: text overlays on MAIN, Amazon badges, prices, coupons, ratings, competitor mentions.',
    '',
    formatAmazonListingReferenceMaterial(),
    '',
    '## Output Format (JSON array):',
    '[{"slot":"MAIN","label":"主图","prompt":"...","negativePrompt":"...","planMarkdown":"..."}]',
  ].join('\n')
}

export function buildListingPlannerUserPrompt(draft: AmazonPromptDraft, imageCount: number): string {
  const slots = getAmazonListingImageSlots(imageCount)
  return [
    `Product: ${draft.productName || draft.title || 'Unknown'}`,
    `Brand: ${draft.brandName || 'N/A'}`,
    ``,
    `Title: ${draft.title || ''}`,
    `Bullets:`,
    ...(draft.bullets || []).map((b, i) => `${i + 1}. ${b}`),
    draft.description ? `\nDescription:\n${draft.description}` : '',
    draft.features?.length ? `\nFeatures:\n${draft.features.map((f) => `- ${f}`).join('\n')}` : '',
    ``,
    `Plan ${imageCount} images for slots: ${slots.join(', ')}`,
  ].filter(Boolean).join('\n')
}

export function buildAPlusPlannerSystemPrompt(): string {
  return [
    'You are a senior Amazon A+ Content planner. Given a product and A+ type, generate a detailed module plan.',
    '',
    '## Rules:',
    '- Each module must serve a clear purpose: brand storytelling, feature explanation, or social proof.',
    '- Copy must be concise, mobile-readable, US-English only.',
    '- Avoid: prices, discounts, QR codes, external URLs, reviews, competitor mentions, unsupported claims.',
    '',
    formatAmazonAPlusReferenceMaterial(),
    '',
    '## Output Format (JSON array):',
    '[{"slot":"A+S01","label":"顶部横幅","prompt":"...","textTitle":"...","textBody":"...","negativePrompt":"...","planMarkdown":"..."}]',
  ].join('\n')
}

export function buildAPlusPlannerUserPrompt(draft: AmazonPromptDraft, contentType: APlusContentType, specs: AmazonAPlusModuleSpec[]): string {
  return [
    `Product: ${draft.productName || draft.title || 'Unknown'}`,
    `Brand: ${draft.brandName || 'N/A'}`,
    `A+ Type: ${getAPlusContentTypeLabel(contentType)}`,
    ``,
    `Title: ${draft.title || ''}`,
    `Bullets:`,
    ...(draft.bullets || []).map((b, i) => `${i + 1}. ${b}`),
    ``,
    `Modules (${specs.length}):`,
    ...specs.map((s) => `- ${s.slot} (${s.displayLabel} ${s.uploadWidth}x${s.uploadHeight}): ${s.objective}`),
  ].filter(Boolean).join('\n')
}

export function buildAmazonPlanPrompt(plan: Pick<AmazonImagePlan, 'prompt' | 'negativePrompt'>): string {
  return [plan.prompt.trim(), plan.negativePrompt?.trim() ? `Negative prompt:\n${plan.negativePrompt.trim()}` : ''].filter(Boolean).join('\n\n')
}
