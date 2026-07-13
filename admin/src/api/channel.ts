import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Channel {
  id: number
  type: string
  name: string
  base_url?: string
  auth_type: string
  keys?: string
  models: string
  groups: string
  weight: number
  priority: number
  status: number
  timeout_seconds: number
  auto_ban: boolean
  fail_count: number
  consecutive_failures: number
  response_time_ms: number
  model_mapping?: Record<string, string>
  status_code_mapping?: Record<string, string>
}

export interface ChannelForm {
  type: string
  name: string
  base_url: string
  auth_type?: string
  keys: string
  models: string
  groups: string
  weight: number
  priority: number
  timeout_seconds: number
  auto_ban: boolean
  model_mapping?: Record<string, string>
  status_code_mapping?: Record<string, string>
}

export interface ChannelTypeInfo {
  type: string
  default_url: string
}

// Reserved for future use
// export function listChannelTypes() {
//   return client.get<ApiResponse<ChannelTypeInfo[]>, ApiResponse<ChannelTypeInfo[]>>('/channels/types')
// }

export function listChannels(page = 1, pageSize = 20, keyword = '') {
  return client.get<ApiResponse<PagedResponse<Channel>>, ApiResponse<PagedResponse<Channel>>>(
    `/channels?page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`,
  )
}

export function createChannel(data: ChannelForm) {
  return client.post<ApiResponse<Channel>, ApiResponse<Channel>>('/channels', data)
}

export function updateChannel(id: number, data: Partial<ChannelForm>) {
  return client.put<ApiResponse<Channel>, ApiResponse<Channel>>(`/channels/${id}`, data)
}

export function deleteChannel(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/channels/${id}`)
}

export function testChannel(id: number) {
  return client.post<ApiResponse<unknown>, ApiResponse<unknown>>(`/channels/${id}/test`)
}

export interface FetchedModelDetail {
  model_name: string
  type: string
  capabilities?: string[]
  input_modalities?: string[]
  output_modalities?: string[]
  context_window?: number
  max_output_tokens?: number
}

export interface FetchUpstreamModelsData {
  fetched: number
  models: string[]
  details?: FetchedModelDetail[]
}

export function fetchChannelModels(id: number) {
  return client.post<ApiResponse<FetchUpstreamModelsData>, ApiResponse<FetchUpstreamModelsData>>(
    `/channels/${id}/fetch-models`,
  )
}

export interface PreviewUpstreamModelsData {
  models: string[]
  existing_types: Record<string, string>
  existing_capabilities?: Record<string, string[]>
  input_modalities?: Record<string, string[]>
  output_modalities?: Record<string, string[]>
}

export interface SyncModelItem {
  model_name: string
  type: string
  capabilities?: string[]
  endpoints?: string[]
}

export interface SyncUpstreamModelsData {
  synced: number
  models: string[]
}

// Reserved for future use
// export function previewChannelModels(id: number) {
//   return client.post<ApiResponse<PreviewUpstreamModelsData>, ApiResponse<PreviewUpstreamModelsData>>(
//     `/channels/${id}/preview-models`,
//   )
// }

// Reserved for future use
// export function syncChannelModels(id: number, models: SyncModelItem[]) {
//   return client.post<ApiResponse<SyncUpstreamModelsData>, ApiResponse<SyncUpstreamModelsData>>(
//     `/channels/${id}/sync-models`,
//     { models },
//   )
// }

// previewModelsFromConfig 根据表单数据预览上游模型（不需要已保存的渠道）
export function previewModelsFromConfig(data: { type: string; base_url: string; keys: string }) {
  return client.post<
    ApiResponse<PreviewUpstreamModelsData>,
    ApiResponse<PreviewUpstreamModelsData>
  >('/channels/preview-models-direct', data)
}

// testChannelFromConfig 根据表单数据测试连通性（不需要已保存的渠道）
export function testChannelFromConfig(data: {
  type: string
  base_url: string
  keys: string
  timeout_seconds: number
}) {
  return client.post<
    ApiResponse<{ response_time_ms: number }>,
    ApiResponse<{ response_time_ms: number }>
  >('/channels/test-direct', data)
}

export interface ChannelTestLog {
  id: number
  channel_id: number
  success: boolean
  response_time_ms: number
  error_message?: string
  probed_at: string
}

export function listTestLogs(channelId: number, page = 1, pageSize = 20) {
  return client.get<
    ApiResponse<PagedResponse<ChannelTestLog>>,
    ApiResponse<PagedResponse<ChannelTestLog>>
  >(`/channels/${channelId}/test-logs?page=${page}&page_size=${pageSize}`)
}

export interface ChannelLoadItem {
  id: number
  name: string
  type: string
  weight: number
  priority: number
  status: number
  recent_requests_1h: number
  weight_pct: number
}

export interface ChannelLoadOverview {
  channels: ChannelLoadItem[]
}

// Reserved for future use
// export function getChannel(id: number) {
//   return client.get<ApiResponse<Channel>, ApiResponse<Channel>>(`/channels/${id}`)
// }

// Reserved for future use — use listGroups() from user.ts instead
// export function listChannelGroups() {
//   return client.get<ApiResponse<string[]>, ApiResponse<string[]>>('/channels/groups')
// }

export function getChannelLoadOverview() {
  return client.get<ApiResponse<ChannelLoadOverview>, ApiResponse<ChannelLoadOverview>>('/channels/load-overview')
}
