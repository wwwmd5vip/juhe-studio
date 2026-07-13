import type { ShowcaseTaskType } from './showcase-types'

export function estimateShowcaseCost(step: ShowcaseTaskType, moduleCount: number): number {
  switch (step) {
    case 'selling_points':
    case 'plan':
      return 1
    case 'images':
      return moduleCount
    default:
      return 0
  }
}
