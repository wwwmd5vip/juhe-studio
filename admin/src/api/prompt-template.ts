import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface PromptTemplate {
  id: number
  name: string
  category: string
  content: string
  variables: string
  usage_count: number
  is_system: boolean
  created_at: string
}

export function listPromptTemplates(params?: {
  category?: string
  keyword?: string
  page?: number
  page_size?: number
}) {
  const searchParams = new URLSearchParams()
  if (params?.category) searchParams.set('category', params.category)
  if (params?.keyword) searchParams.set('keyword', params.keyword)
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.page_size) searchParams.set('page_size', String(params.page_size))
  const qs = searchParams.toString()
  return client.get<ApiResponse<PagedResponse<PromptTemplate>>, ApiResponse<PagedResponse<PromptTemplate>>>(
    `/prompt-templates${qs ? `?${qs}` : ''}`,
  )
}

export function usePromptTemplate(id: number) {
  return client.post<ApiResponse<unknown>, ApiResponse<unknown>>(`/prompt-templates/${id}/use`)
}
