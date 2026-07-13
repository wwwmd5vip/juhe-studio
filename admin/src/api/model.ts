import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Model {
  id: number
  model_name: string
  display_name: string
  upstream_name: string
  type: string
  capabilities: string[]
  endpoints: string[]
  match_rule: number
  context_window: number
  max_output_tokens: number
  status: number
  has_pricing?: boolean
  created_at?: string
  updated_at?: string
}

export interface ModelChannel {
  id: number
  name: string
  type: string
  status: number
  base_url?: string
  group: string
}

export interface ModelForm {
  model_name: string
  display_name: string
  upstream_name: string
  type: string
  channel_ids?: number[]
  capabilities: string[]
  endpoints: string[]
  context_window?: number
  max_output_tokens?: number
  match_rule: number
}

export function listModels(page = 1, pageSize = 20, keyword = '', channelId?: number) {
  let url = `/models?page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`
  if (channelId) {
    url += `&channel_id=${channelId}`
  }
  return client.get<ApiResponse<PagedResponse<Model>>, ApiResponse<PagedResponse<Model>>>(url)
}

export function createModel(data: ModelForm) {
  return client.post<ApiResponse<Model>, ApiResponse<Model>>('/models', data)
}

export function updateModel(id: number, data: Partial<ModelForm> & { status?: number }) {
  return client.put<ApiResponse<Model>, ApiResponse<Model>>(`/models/${id}`, data)
}

export function getModel(id: number) {
  return client.get<ApiResponse<Model>, ApiResponse<Model>>(`/models/${id}`)
}

export function deleteModel(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/models/${id}`)
}

export function listModelChannels(id: number) {
  return client.get<ApiResponse<ModelChannel[]>, ApiResponse<ModelChannel[]>>(`/models/${id}/channels`)
}
