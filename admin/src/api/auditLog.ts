import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface AuditLogItem {
  id: number
  operator_id: number
  operator_name: string
  action: string
  target_type: string
  target_id: number
  old_value?: string
  new_value?: string
  diff?: string
  created_at: string
}

export function listAuditLogs(params?: {
  page?: number
  page_size?: number
  operator_name?: string
  action?: string
  target_type?: string
  start_date?: string
  end_date?: string
}) {
  return client.get<ApiResponse<PagedResponse<AuditLogItem>>, ApiResponse<PagedResponse<AuditLogItem>>>(
    '/audit-logs',
    { params },
  )
}
