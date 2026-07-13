import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Pricing {
  id: number
  model_name: string
  group: string
  billing_mode: string
  model_ratio: number
  completion_ratio: number
  cached_tokens_ratio: number
  fixed_price_cents: number
  image_ratio: number
  tiered_expr: string
  status?: number
  created_at?: string
  updated_at?: string
}

export interface PricingForm {
  model_name: string
  group: string
  billing_mode: string
  model_ratio: number
  completion_ratio: number
  cached_tokens_ratio: number
  fixed_price_cents: number
  image_ratio: number
  tiered_expr: string
}

// Reserved for future use
// export function getPricing(id: number) {
//   return client.get<ApiResponse<Pricing>, ApiResponse<Pricing>>(`/pricing/${id}`)
// }

export function listPricing(
  page = 1,
  pageSize = 20,
  model_name = '',
  group = '',
) {
  return client.get<ApiResponse<PagedResponse<Pricing>>, ApiResponse<PagedResponse<Pricing>>>(
    `/pricing?page=${page}&page_size=${pageSize}&model_name=${encodeURIComponent(model_name)}&group=${encodeURIComponent(group)}`,
  )
}

export function createPricing(data: PricingForm) {
  return client.post<ApiResponse<Pricing>, ApiResponse<Pricing>>('/pricing', data)
}

export function updatePricing(id: number, data: Partial<PricingForm>) {
  return client.put<ApiResponse<Pricing>, ApiResponse<Pricing>>(`/pricing/${id}`, data)
}

export function deletePricing(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/pricing/${id}`)
}

export interface BatchPricingItem {
  group: string
  billing_mode: string
  model_ratio: number
  completion_ratio: number
  cached_tokens_ratio: number
  fixed_price_cents?: number | null
  image_ratio?: number
  tiered_expr?: string
  effective_from?: string | null
}

export function batchCreatePricing(
  modelName: string,
  items: BatchPricingItem[],
  overwrite: boolean,
) {
  return client.post<ApiResponse<{ affected: number }>, ApiResponse<{ affected: number }>>(
    '/pricing/batch',
    { model_name: modelName, items, overwrite },
  )
}

export function syncUpstreamPricing(channelId: number) {
  return client.post<ApiResponse<{ synced: number }>, ApiResponse<{ synced: number }>>(
    '/pricing/sync-upstream',
    { channel_id: channelId },
  )
}

export function syncPresetPricing(preset: string) {
  return client.post<ApiResponse<{ synced: number }>, ApiResponse<{ synced: number }>>(
    '/pricing/sync-preset',
    { preset },
  )
}
