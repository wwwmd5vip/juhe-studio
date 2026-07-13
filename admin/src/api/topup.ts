import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface TopUp {
  id: number
  user_id: number
  package_id?: number
  amount_cents: number
  quota_granted: number
  currency: string
  payment_method: string
  payment_status: number
  transaction_id?: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export interface TopUpForm {
  user_id: number
  quota_granted: number
}

export function listTopUps(
  page = 1,
  pageSize = 20,
  userId?: number,
  status?: number,
  startDate?: string,
  endDate?: string,
) {
  let url = `/topups?page=${page}&page_size=${pageSize}`
  if (userId) {
    url += `&user_id=${userId}`
  }
  if (status !== undefined) {
    url += `&status=${status}`
  }
  if (startDate) {
    url += `&start_date=${startDate}`
  }
  if (endDate) {
    url += `&end_date=${endDate}`
  }
  return client.get<ApiResponse<PagedResponse<TopUp>>, ApiResponse<PagedResponse<TopUp>>>(url)
}

export function createTopUp(data: TopUpForm) {
  return client.post<ApiResponse<TopUp>, ApiResponse<TopUp>>('/topups', data)
}

export function markTopUpPaid(id: number, transactionId = '') {
  return client.post<ApiResponse<TopUp>, ApiResponse<TopUp>>(
    `/topups/${id}/paid?transaction_id=${encodeURIComponent(transactionId)}`,
  )
}

export function markTopUpFailed(id: number) {
  return client.post<ApiResponse<TopUp>, ApiResponse<TopUp>>(`/topups/${id}/failed`)
}

export function refundTopUp(id: number) {
  return client.post<ApiResponse<TopUp>, ApiResponse<TopUp>>(`/topups/${id}/refund`)
}

// Reserved for future use
// export function getTopUp(id: number) {
//   return client.get<ApiResponse<TopUp>, ApiResponse<TopUp>>(`/topups/${id}`)
// }

export function batchUpdateTopUpStatus(ids: number[], status: string) {
  return client.post<{ ids: number[]; status: string }, ApiResponse<{ affected: number }>>(
    '/topups/batch-status',
    { ids, status },
  )
}
