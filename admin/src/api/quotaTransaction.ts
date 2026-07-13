import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface QuotaTransaction {
  id: number
  user_id: number
  token_id?: number
  type: string
  amount: number
  balance_after: number
  related_id?: string
  related_type?: string
  description?: string
  created_at: string
}

export function listQuotaTransactions(params?: {
  page?: number
  page_size?: number
  user_id?: number
  type?: string
  start_date?: string
  end_date?: string
}) {
  return client.get<ApiResponse<PagedResponse<QuotaTransaction>>, ApiResponse<PagedResponse<QuotaTransaction>>>(
    '/quota-transactions',
    { params }
  )
}
