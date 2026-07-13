import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Token {
  id: number
  user_id?: number
  name: string
  key?: string
  key_mask: string
  status: number
  remain_quota: number
  unlimited_quota: boolean
  group: string
  model_limits: string[]
  last_used_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface TokenForm {
  name: string
  remain_quota: number
  unlimited_quota: boolean
  group: string
  model_limits: string[]
}

export function listTokens(page = 1, pageSize = 20, keyword = '', all = false) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (keyword) params.set('keyword', keyword)
  if (all) params.set('all', 'true')
  return client.get<ApiResponse<PagedResponse<Token>>, ApiResponse<PagedResponse<Token>>>(
    `/tokens?${params.toString()}`,
  )
}

export function createToken(data: TokenForm) {
  return client.post<ApiResponse<Token>, ApiResponse<Token>>('/tokens', data)
}

export function updateToken(id: number, data: Partial<TokenForm> & { status?: number }) {
  return client.put<ApiResponse<Token>, ApiResponse<Token>>(`/tokens/${id}`, data)
}

export function deleteToken(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/tokens/${id}`)
}

export function batchDeleteTokens(ids: number[]) {
  return client.post<ApiResponse<unknown>, ApiResponse<unknown>>('/tokens/batch-delete', { ids })
}

export interface TokenDailyStat {
  date: string
  requests: number
  tokens: number
  quota_used: number
}

// Reserved for future use
// export function getToken(id: number) {
//   return client.get<ApiResponse<Token>, ApiResponse<Token>>(`/tokens/${id}`)
// }

export function getTokenStats(id: number, days = 30) {
  return client.get<ApiResponse<TokenDailyStat[]>, ApiResponse<TokenDailyStat[]>>(`/tokens/${id}/stats?days=${days}`)
}

// Reserved: endpoint not yet implemented on server
// export function revealTokenKey(id: number, password: string) {
//   return client.post<ApiResponse<{ key: string }>, ApiResponse<{ key: string }>>(
//     `/tokens/${id}/reveal`,
//     { password },
//   )
// }
