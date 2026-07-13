import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Vendor {
  id: number
  name: string
  description?: string
  icon_url?: string
  created_at: string
  updated_at: string
}

export interface VendorForm {
  name: string
  description?: string
  icon_url?: string
}

export function listVendors(page = 1, pageSize = 20, keyword = '') {
  return client.get<ApiResponse<PagedResponse<Vendor>>, ApiResponse<PagedResponse<Vendor>>>(
    `/vendors?page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`,
  )
}

export function createVendor(data: VendorForm) {
  return client.post<ApiResponse<Vendor>, ApiResponse<Vendor>>('/vendors', data)
}

// Reserved for future use
// export function getVendor(id: number) {
//   return client.get<ApiResponse<Vendor>, ApiResponse<Vendor>>(`/vendors/${id}`)
// }

export function updateVendor(id: number, data: Partial<VendorForm>) {
  return client.put<ApiResponse<Vendor>, ApiResponse<Vendor>>(`/vendors/${id}`, data)
}

export function deleteVendor(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/vendors/${id}`)
}
