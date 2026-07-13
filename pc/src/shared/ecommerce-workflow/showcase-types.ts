import { z } from 'zod'
import type { Language, Market, Platform } from './enums'

export interface ShowcaseConfig {
  productImage: string
  productText?: string
  platform: Platform
  market: Market
  language: Language
  modules: string[]
  visionChatProviderId: string
  visionChatModelId: string
  imageProviderId: string
  imageModelId: string
}

export type GenerateSellingPointsInput = ShowcaseConfig

export interface GeneratePlanInput extends ShowcaseConfig {
  sellingPoints: string[]
}

export interface GenerateImagesInput extends ShowcaseConfig {
  plan: PlanResult
}

export interface SellingPointsResult {
  sellingPoints: string[]
}

export const PlanModuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  imagePrompt: z.string(),
  copyRequirements: z.string()
})

export type PlanModule = z.infer<typeof PlanModuleSchema>

export interface PlanResult {
  modules: PlanModule[]
}

export type ShowcaseImageItem =
  | { id: string; order: number; status: 'pending'; title: string }
  | { id: string; order: number; status: 'success'; url: string }
  | { id: string; order: number; status: 'error'; error: string }

export interface ImagesResult {
  images: ShowcaseImageItem[]
}

export type ShowcaseTaskType = 'selling_points' | 'plan' | 'images'
export type ShowcaseTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ShowcaseTask {
  id: string
  type: ShowcaseTaskType
  status: ShowcaseTaskStatus
  input: GenerateSellingPointsInput | GeneratePlanInput | GenerateImagesInput
  result?: SellingPointsResult | PlanResult | ImagesResult
  errorMsg?: string
  pointCost?: number
  generationTaskIds?: string[]
  createdAt: string
  updatedAt: string
}

export type { Language, Market, Platform } from './enums'
