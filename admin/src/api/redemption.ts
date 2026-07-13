import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Redemption {
  id: number
  code: string
  quota_value: number
  status: number
  used_by?: number
  used_at?: string
  expires_at?: string
  created_at: string
}

export interface RedemptionForm {
  count: number
  quota_value: number
  prefix?: string
  expires_at?: string
}

export function listRedemptions(page = 1, pageSize = 20, status?: number) {
  let url = `/redemptions?page=${page}&page_size=${pageSize}`
  if (status !== undefined) {
    url += `&status=${status}`
  }
  return client.get<ApiResponse<PagedResponse<Redemption>>, ApiResponse<PagedResponse<Redemption>>>(url)
}

export function generateRedemptions(data: RedemptionForm) {
  return client.post<ApiResponse<Redemption[]>, ApiResponse<Redemption[]>>('/redemptions', data)
}

export function deleteRedemption(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/redemptions/${id}`)
}
