import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface QuotaPackage {
  id: number
  name: string
  quota_value: number
  price_cents: number
  currency: string
  status: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface QuotaPackageForm {
  name: string
  quota_value: number
  price_cents: number
  currency: string
  sort_order: number
}

export function listQuotaPackages(page = 1, pageSize = 20, keyword?: string) {
  let url = `/quota-packages?page=${page}&page_size=${pageSize}`
  if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`
  return client.get<ApiResponse<PagedResponse<QuotaPackage>>, ApiResponse<PagedResponse<QuotaPackage>>>(url)
}

export function createQuotaPackage(data: QuotaPackageForm) {
  return client.post<ApiResponse<QuotaPackage>, ApiResponse<QuotaPackage>>('/quota-packages', data)
}

export function updateQuotaPackage(id: number, data: Partial<QuotaPackageForm> & { status?: number }) {
  return client.put<ApiResponse<QuotaPackage>, ApiResponse<QuotaPackage>>(`/quota-packages/${id}`, data)
}

export function deleteQuotaPackage(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/quota-packages/${id}`)
}

export function batchUpdateQuotaPackageStatus(ids: number[], status: number) {
  return client.post<ApiResponse<null>, ApiResponse<null>>('/quota-packages/batch-status', { ids, status })
}

export function batchDeleteQuotaPackage(ids: number[]) {
  return client.post<ApiResponse<null>, ApiResponse<null>>('/quota-packages/batch-delete', { ids })
}
