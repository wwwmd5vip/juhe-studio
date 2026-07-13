import { client } from './client'
import { useAuthStore } from '../stores/authStore'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Log {
  id: number
  user_id: number
  token_id?: number
  channel_id?: number
  model_name: string
  request_id: string
  type: string
  mode: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  image_n: number
  quota_used: number
  quota_pre_consumed: number
  status_code: number
  upstream_status?: string
  ip_address: string
  user_agent: string
  request_content: string
  response_content: string
  error_message: string
  use_time_ms: number
  created_at: string
}

export interface LogFilter {
  user_id?: number
  token_id?: number
  model_name?: string
  keyword?: string
  type?: string
  status_code?: number
  channel_id?: number
  ip_address?: string
  start_date?: string
  end_date?: string
}

function buildLogFilterUrl(baseUrl: string, filter: LogFilter): string {
  let url = baseUrl
  if (filter.user_id) url += `&user_id=${filter.user_id}`
  if (filter.token_id) url += `&token_id=${filter.token_id}`
  if (filter.model_name) url += `&model_name=${encodeURIComponent(filter.model_name)}`
  if (filter.keyword) url += `&keyword=${encodeURIComponent(filter.keyword)}`
  if (filter.type) url += `&type=${encodeURIComponent(filter.type)}`
  if (filter.status_code) url += `&status_code=${filter.status_code}`
  if (filter.channel_id) url += `&channel_id=${filter.channel_id}`
  if (filter.ip_address) url += `&ip_address=${encodeURIComponent(filter.ip_address)}`
  if (filter.start_date) url += `&start_date=${encodeURIComponent(filter.start_date)}`
  if (filter.end_date) url += `&end_date=${encodeURIComponent(filter.end_date)}`
  return url
}

export function listLogs(page = 1, pageSize = 20, filter: LogFilter = {}) {
  const url = buildLogFilterUrl(`/logs?page=${page}&page_size=${pageSize}`, filter)
  return client.get<ApiResponse<PagedResponse<Log>>, ApiResponse<PagedResponse<Log>>>(url)
}

/** 导出日志为 CSV 文件（返回 Blob） */
export async function exportLogsCSV(filter: LogFilter = {}): Promise<Blob> {
  const url = buildLogFilterUrl('/logs/export/csv?', filter)
  const token = localStorage.getItem('juhe_token')
  const resp = await fetch(`${client.defaults.baseURL}${url}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!resp.ok) {
    if (resp.status === 401) {
      localStorage.removeItem('juhe_token')
      useAuthStore.getState().logout()
      throw new Error('未登录')
    }
    throw new Error(`导出失败: ${resp.status}`)
  }
  return resp.blob()
}
