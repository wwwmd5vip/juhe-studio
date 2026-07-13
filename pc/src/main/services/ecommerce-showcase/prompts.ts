import { getModuleLabel, getModuleTypesByCategory, MODULE_TYPES } from '@shared/ecommerce-workflow/module-types'
import { LANGUAGE_NAMES, MARKET_TONE } from '@shared/ecommerce-workflow/platform-presets'
import { PLATFORM_STYLES } from '@shared/ecommerce-workflow/platform-styles'
import type { GeneratePlanInput, GenerateSellingPointsInput } from '@shared/ecommerce-workflow/showcase-types'
import { buildProductOnlyPrompt } from '@shared/utils/image-prompt-safety'
import type { ContentPart } from '../ecommerce-workflow/utils'

function getSafeModuleLabel(id: string, language: GeneratePlanInput['language']) {
  if (id === 'model_scene') {
    return language === 'zh'
      ? { name: '单品场景图', description: '商品置于静物或展示场景中，不出现人物、脚部或试穿画面' }
      : { name: 'Product Scene', description: 'Product-only scene without people, feet, or try-on visuals' }
  }

  if (id === 'user_review') {
    return language === 'zh'
      ? { name: '商品反馈图', description: '用静物陈列或场景氛围传达真实使用反馈，不出现真人' }
      : {
          name: 'Product Feedback Scene',
          description: 'Convey user feedback through product-only display and scene cues'
        }
  }

  if (id === 'before_after') {
    return language === 'zh'
      ? { name: '前后对比图', description: '用商品本身的状态变化和版式对比表现前后效果' }
      : {
          name: 'Before & After Product',
          description: 'Show product-state comparison through layout and product details only'
        }
  }

  return null
}

export function buildSellingPointsPrompt(config: GenerateSellingPointsInput): { system: string; user: ContentPart[] } {
  const style = PLATFORM_STYLES[config.platform]
  const market = MARKET_TONE[config.market]
  const system = `You are an expert e-commerce copywriter. Analyze the product image and generate 3-5 concise selling points for ${config.platform}.

Platform style requirements:
- Visual: ${style.visualKeywords}
- Composition: ${style.compositionHint}
- Color tone: ${style.colorTone}
- Avoid: ${style.doNotInclude}

Market tone: ${market.temperature}, ${market.examples}
Language: ${LANGUAGE_NAMES[config.language]}
Product notes: ${config.productText ?? 'None'}

Return strictly JSON: { "selling_points": ["...", "..."] }`

  const user: ContentPart[] = [
    { type: 'image', image: config.productImage },
    { type: 'text', text: 'Generate selling points for this product.' }
  ]

  return { system, user }
}

export function buildPlanPrompt(config: GeneratePlanInput): { system: string; user: ContentPart[] } {
  const style = PLATFORM_STYLES[config.platform]
  const market = MARKET_TONE[config.market]
  const modulePool = config.modules
    .map((id) => {
      const def = MODULE_TYPES.find((m) => m.id === id)
      if (!def) return `- ${id}`
      const safeLabel = getSafeModuleLabel(id, config.language) ?? getModuleLabel(def, config.language)
      return `- ${id}: ${safeLabel.name} — ${safeLabel.description}`
    })
    .join('\n')

  const conversionRules = getModuleTypesByCategory('conversion')
    .map((module) => `- ${module.id}: ${getSafeModuleLabel(module.id, config.language)?.description ?? ''}`)
    .join('\n')

  const system = `You are an e-commerce visual planner. Based on the product image and selling points, generate a detailed image generation plan for each selected module.

Platform style requirements:
- Visual: ${style.visualKeywords}
- Composition: ${style.compositionHint}
- Color tone: ${style.colorTone}
- Avoid: ${style.doNotInclude}

Market tone: ${market.temperature}, ${market.examples}
Language: ${LANGUAGE_NAMES[config.language]}

Safety and product-focus rules:
- Focus on standalone product display and commercial product scenes.
- Do not include human models, faces, bodies, legs, feet, try-on scenes, children, or portraits.
- Do not describe the product as worn by a person; place it on props, shelves, tabletops, display stands, or clean lifestyle scenes.
- If a module would naturally imply a person or try-on scene, rewrite it to a product-only studio or tabletop composition.
- Keep prompts concise and visually specific so image models do not return empty content.

Conversion module rewrite rules:
${conversionRules}

Selected modules:
${modulePool}

Return strictly JSON:
{
  "modules": [
    { "id": "module_id", "title": "...", "imagePrompt": "...", "copyRequirements": "..." }
  ]
}`

  const user: ContentPart[] = [
    { type: 'image', image: config.productImage },
    {
      type: 'text',
      text: buildProductOnlyPrompt(
        `Selling points:\n${config.sellingPoints.join('\n')}\n\nGenerate the plan with product-only visuals.`,
        {
          platformStyle: {
            visualKeywords: style.visualKeywords,
            compositionHint: style.compositionHint,
            colorTone: style.colorTone
          }
        }
      )
    }
  ]

  return { system, user }
}
