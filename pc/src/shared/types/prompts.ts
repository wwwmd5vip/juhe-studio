// Types matching the Juhe Management backend (/v1/prompts) relay API.

export interface PromptListFilters {
  page?: number
  pageSize?: number
  type?: 'image' | 'agent' | 'package'
  keyword?: string
  tag?: string
  category_id?: number
}

export interface PromptListItem {
  id: number
  type: 'image' | 'agent' | 'package'
  category_id: number
  title: string
  variables?: Record<string, string>
  tags?: string[]
  status: number // 0=draft, 1=published, 2=archived
  author_id: number
  created_at: string
  updated_at: string
}

export interface PromptDetail {
  id: number
  type: 'image' | 'agent' | 'package'
  category_id: number
  title: string
  content: string
  variables?: Record<string, string>
  tags?: string[]
  status: number
  author_id: number
  created_at: string
  updated_at: string
}

export interface PromptPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PromptListResponse {
  data: PromptListItem[]
  pagination: PromptPagination
}

export interface PromptFiltersResponse {
  types: string[]
}

export interface RenderResult {
  content: string
}

export type PromptErrorCode =
  | 'PROMPTS_SERVICE_UNREACHABLE'
  | 'PROMPTS_SERVICE_ERROR'
  | 'PROMPT_NOT_FOUND'
  | 'INVALID_PARAMETER'

export interface PromptServiceError {
  message: string
  code: PromptErrorCode
  status?: number
}
