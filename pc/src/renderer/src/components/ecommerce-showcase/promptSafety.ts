import type { PlanResult } from '@shared/ecommerce-workflow/showcase-types'

const HUMAN_PROMPT_RE =
  /\b(woman|women|man|men|girl|boy|person|people|model|face|faces|body|bodies|leg|legs|foot|feet|wearing|wears|walking|walking\s+in|try-?on|on\s+feet|footwear\s+on\s+feet)\b|女性|男性|女人|男人|女孩|男孩|真人|人物|人像|模特|用户|脸|面部|身体|腿|脚|脚部|穿着|脚穿|试穿|走路|行走|咖啡厅|街边|咖啡馆|街道|街头/i

export interface UnsafeImageModule {
  id: string
  title: string
}

export function findUnsafeImageModules(plan?: PlanResult): UnsafeImageModule[] {
  if (!plan) return []

  return plan.modules
    .filter((module) => HUMAN_PROMPT_RE.test([module.title, module.imagePrompt, module.copyRequirements].join('\n')))
    .map((module) => ({ id: module.id, title: module.title }))
}
