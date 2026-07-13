import type { AspectRatio, Language } from './enums'

export type ModuleTypeCategory = 'core' | 'white' | 'usage' | 'conversion'

export interface ModuleTypeDefinition {
  id: string
  category: ModuleTypeCategory
  labels: Partial<Record<Language, { name: string; description: string }>>
  defaultAspectRatio: AspectRatio
}

export const MODULE_TYPES: ModuleTypeDefinition[] = [
  {
    id: 'main_visual',
    category: 'core',
    labels: {
      zh: { name: '主视觉场景图', description: '产品置于真实使用场景中的氛围图，突出整体风格' },
      en: {
        name: 'Main Visual Scene',
        description: 'Product placed in a real-life usage scene, highlighting overall style'
      }
    },
    defaultAspectRatio: '3:4'
  },
  {
    id: 'selling_point',
    category: 'core',
    labels: {
      zh: { name: '卖点特写图', description: '聚焦 1-2 个核心卖点或关键细节' },
      en: { name: 'Selling Point Close-up', description: 'Focus on 1-2 core selling points or key details' }
    },
    defaultAspectRatio: '3:4'
  },
  {
    id: 'parameters',
    category: 'core',
    labels: {
      zh: { name: '参数规格图', description: '以清晰排版展示产品规格、尺寸与材质信息' },
      en: { name: 'Specifications Chart', description: 'Clean layout showing specs, dimensions, and material info' }
    },
    defaultAspectRatio: '1:1'
  },
  {
    id: 'trust',
    category: 'core',
    labels: {
      zh: { name: '信任背书图', description: '展示认证、奖项、品牌承诺或质检信息' },
      en: { name: 'Trust Endorsement', description: 'Certifications, awards, brand promises, or quality assurance' }
    },
    defaultAspectRatio: '1:1'
  },
  {
    id: 'white_background_main',
    category: 'white',
    labels: {
      zh: { name: '白底主图', description: '纯白背景下的产品正面主图' },
      en: { name: 'White Background Main', description: 'Product front view on pure white background' }
    },
    defaultAspectRatio: '1:1'
  },
  {
    id: 'white_background_multi',
    category: 'white',
    labels: {
      zh: { name: '白底多视角图', description: '纯白背景下的多角度展示' },
      en: { name: 'White Background Multi-angle', description: 'Multi-angle product views on pure white background' }
    },
    defaultAspectRatio: '1:1'
  },
  {
    id: 'size_comparison',
    category: 'white',
    labels: {
      zh: { name: '尺寸对比图', description: '产品与常见参照物对比，直观展示大小' },
      en: { name: 'Size Comparison', description: 'Product compared with a common reference object to show scale' }
    },
    defaultAspectRatio: '1:1'
  },
  {
    id: 'usage_steps',
    category: 'usage',
    labels: {
      zh: { name: '使用步骤图', description: '分步骤展示产品使用方法或流程' },
      en: { name: 'Usage Steps', description: 'Step-by-step demonstration of how to use the product' }
    },
    defaultAspectRatio: '3:4'
  },
  {
    id: 'packaging',
    category: 'usage',
    labels: {
      zh: { name: '包装清单图', description: '展示包装外观与盒内配件清单' },
      en: { name: 'Packaging & Contents', description: 'Packaging exterior and list of included accessories' }
    },
    defaultAspectRatio: '1:1'
  },
  {
    id: 'detail_exploded',
    category: 'usage',
    labels: {
      zh: { name: '细节爆炸图', description: '分层或爆炸式展示产品结构与细节' },
      en: {
        name: 'Detail Exploded View',
        description: 'Layered or exploded view showing product structure and details'
      }
    },
    defaultAspectRatio: '3:4'
  },
  {
    id: 'model_scene',
    category: 'conversion',
    labels: {
      zh: { name: '模特穿搭/搭配场景图', description: '真人模特或场景搭配展示，提升种草感' },
      en: { name: 'Model Scene', description: 'Real model or styled scene to inspire purchase desire' }
    },
    defaultAspectRatio: '9:16'
  },
  {
    id: 'before_after',
    category: 'conversion',
    labels: {
      zh: { name: 'Before/After 对比图', description: '使用前后的直观效果对比' },
      en: { name: 'Before & After', description: 'Clear visual comparison before and after use' }
    },
    defaultAspectRatio: '3:4'
  },
  {
    id: 'user_review',
    category: 'conversion',
    labels: {
      zh: { name: '用户评价场景图', description: '模拟真实用户评价或使用反馈的场景' },
      en: { name: 'User Review Scene', description: 'Scene simulating authentic user review or feedback' }
    },
    defaultAspectRatio: '3:4'
  }
]

export function getModuleTypeById(id: string): ModuleTypeDefinition | undefined {
  return MODULE_TYPES.find((m) => m.id === normalizeModuleId(id))
}

export function getModuleTypesByCategory(category: ModuleTypeCategory): ModuleTypeDefinition[] {
  return MODULE_TYPES.filter((m) => m.category === category)
}

export function getModuleLabel(def: ModuleTypeDefinition, language: Language): { name: string; description: string } {
  return def.labels[language] ?? def.labels.en ?? def.labels.zh ?? { name: def.id, description: '' }
}

export function renderModulePool(language: Language): string {
  return MODULE_TYPES.map((m) => {
    const label = getModuleLabel(m, language)
    return `- ${m.id}: ${label.name} — ${label.description}`
  }).join('\n')
}

export function normalizeModuleId(id: string): string {
  return id.trim().toLowerCase().replace(/-/g, '_')
}
