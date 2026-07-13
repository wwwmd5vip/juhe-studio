/**
 * Juhe Management Prompts Service
 * Uses JuheClient SDK to call the relay /v1/prompts API.
 */

import type { PromptListItem } from '@juhe-management/client'
import { JuheClient } from '@juhe-management/client'
import type {
  PromptFiltersResponse,
  PromptListFilters,
  PromptListResponse,
  PromptServiceError
} from '@shared/types/prompts'
import { errorMessage } from '@shared/utils/error-classifier'
import store, { getJuheBaseUrl } from '../stores/config'

// ── Error helpers ──

const ERROR_CODES: PromptServiceError['code'][] = [
  'PROMPTS_SERVICE_UNREACHABLE',
  'PROMPTS_SERVICE_ERROR',
  'PROMPT_NOT_FOUND',
  'INVALID_PARAMETER'
]

function makeError(code: PromptServiceError['code'], message: string, status?: number): PromptServiceError {
  return { code, message, status }
}

function isKnownError(e: unknown): e is PromptServiceError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    ERROR_CODES.includes((e as { code: unknown }).code as PromptServiceError['code']) &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  )
}

function mapError(error: unknown): PromptServiceError {
  if (isKnownError(error)) return error

  const msg = errorMessage(error)

  // Network-level errors
  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('fetch failed') ||
    msg.includes('Network Error') ||
    msg.includes('timeout')
  ) {
    return makeError('PROMPTS_SERVICE_UNREACHABLE', 'Prompts service is unreachable')
  }

  // Axios HTTP errors
  const axiosError = error as { response?: { status?: number; data?: { code?: number; message?: string } } }
  if (axiosError.response) {
    const status = axiosError.response.status
    if (status === 404) {
      return makeError('PROMPT_NOT_FOUND', axiosError.response.data?.message || 'Prompt not found', status)
    }
    if (status === 400) {
      return makeError('INVALID_PARAMETER', axiosError.response.data?.message || 'Invalid parameter', status)
    }
    return makeError('PROMPTS_SERVICE_ERROR', axiosError.response.data?.message || `HTTP ${status}`, status)
  }

  return makeError('PROMPTS_SERVICE_ERROR', msg)
}

// ── Client factory ──

function getApiKey(): string | null {
  try {
    const k = store.get('auth.apiKey')
    return typeof k === 'string' && k.length > 0 && !k.includes('*') ? k : null
  } catch {
    return null
  }
}

function makeClient(): JuheClient {
  const baseURL = getJuheBaseUrl()
  const apiKey = getApiKey()
  if (!apiKey) {
    throw makeError('PROMPTS_SERVICE_ERROR', '请先登录 Juhe Management 后使用提示词广场功能')
  }
  return new JuheClient({ baseURL, apiKey, timeout: 30000 })
}

// ── Mappers ──

function toPromptItem(remote: PromptListItem): import('@shared/types/prompts').PromptListItem {
  return {
    id: remote.id,
    type: remote.type,
    category_id: remote.category_id,
    title: remote.title,
    variables: remote.variables,
    tags: remote.tags,
    status: remote.status,
    author_id: remote.author_id,
    created_at: remote.created_at,
    updated_at: remote.updated_at
  }
}

// ── Public API ──

export async function fetchPrompts(filters: PromptListFilters): Promise<PromptListResponse> {
  try {
    const client = makeClient()
    const type = filters.type || 'image'
    const result = await client.listPrompts(type, {
      page: filters.page,
      page_size: filters.pageSize,
      category_id: filters.category_id,
      tag: filters.tag,
      keyword: filters.keyword
    })

    return {
      data: result.data.map(toPromptItem),
      pagination: {
        page: result.pagination.page,
        pageSize: result.pagination.page_size,
        total: result.pagination.total,
        totalPages: result.pagination.total_pages
      }
    }
  } catch (error) {
    throw mapError(error)
  }
}

export async function fetchFilters(): Promise<PromptFiltersResponse> {
  try {
    const client = makeClient()
    const result = await client.listPromptCategories('image')
    return {
      types: result.data.map((c: { name: string }) => c.name)
    }
  } catch (error) {
    throw mapError(error)
  }
}

export async function fetchPrompt(
  id: number
): Promise<{ item: import('@shared/types/prompts').PromptDetail; rendered?: string }> {
  try {
    const client = makeClient()
    const detail = await client.getPrompt(id)

    const item: import('@shared/types/prompts').PromptDetail = {
      id: detail.id,
      type: detail.type,
      category_id: detail.category_id,
      title: detail.title,
      content: detail.content,
      variables: detail.variables,
      tags: detail.tags,
      status: detail.status,
      author_id: detail.author_id,
      created_at: detail.created_at,
      updated_at: detail.updated_at
    }

    // Return raw content — variables are type descriptors, not actual values.
    // The frontend will pass the template to /generate where the user fills in variables.
    return { item, rendered: detail.content }
  } catch (error) {
    throw mapError(error)
  }
}
