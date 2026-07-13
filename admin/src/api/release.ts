import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Release {
  id: number
  version: string
  platform: string
  download_url: string
  file_size: number
  sha256: string
  release_notes: string
  min_app_version: string
  status: number // 0=draft, 1=published, 2=archived
  published_at?: string
  created_at: string
  updated_at: string
}

export interface ReleaseForm {
  version: string
  platform: string
  download_url: string
  file_size?: number
  sha256?: string
  release_notes?: string
  min_app_version?: string
}

const PLATFORM_LABELS: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
}

export function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] || platform
}

export const PLATFORM_OPTIONS = Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label }))

export function listReleases(page = 1, pageSize = 20, keyword = '') {
  return client.get<ApiResponse<PagedResponse<Release>>, ApiResponse<PagedResponse<Release>>>(
    `/releases?page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`,
  )
}

// Reserved for future use
// export function getRelease(id: number) {
//   return client.get<ApiResponse<Release>, ApiResponse<Release>>(`/releases/${id}`)
// }

export function createRelease(data: ReleaseForm) {
  return client.post<ApiResponse<Release>, ApiResponse<Release>>('/releases', data)
}

export function updateRelease(id: number, data: Partial<ReleaseForm>) {
  return client.put<ApiResponse<Release>, ApiResponse<Release>>(`/releases/${id}`, data)
}

export function deleteRelease(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/releases/${id}`)
}

export function publishRelease(id: number) {
  return client.post<ApiResponse<Release>, ApiResponse<Release>>(`/releases/${id}/publish`)
}
