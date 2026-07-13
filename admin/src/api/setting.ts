import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Setting {
  id: number
  key: string
  value: string
  type: string
  category: string
  description: string
}

export interface SettingForm {
  key: string
  value: string
  type: string
  category: string
  description: string
}

export function listSettings(page = 1, pageSize = 20) {
  return client.get<ApiResponse<PagedResponse<Setting>>, ApiResponse<PagedResponse<Setting>>>(`/settings?page=${page}&page_size=${pageSize}`)
}

export function upsertSetting(data: SettingForm) {
  return client.post<ApiResponse<Setting>, ApiResponse<Setting>>('/settings', data)
}

export function deleteSetting(key: string) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/settings/${key}`)
}

export function getSetting(key: string) {
  return client.get<ApiResponse<Setting>, ApiResponse<Setting>>(`/settings/${key}`)
}

export function bulkUpdateSettings(settings: { key: string; value: string }[]) {
  return client.put<ApiResponse<null>, ApiResponse<null>>('/settings/bulk', { settings })
}

export function getSettingsCategorized() {
  return client.get<ApiResponse<Record<string, Setting[]>>, ApiResponse<Record<string, Setting[]>>>('/settings/categorized')
}

export function testEmail(email: string) {
  return client.post<ApiResponse<unknown>, ApiResponse<unknown>>('/settings/test-email', { email })
}
