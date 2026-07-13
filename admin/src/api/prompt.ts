import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Prompt {
  id: number
  type: string
  category_id: number
  title: string
  content: string
  status: number
  author_id: number
  variables: Record<string, string>
  tags: string[]
}

export interface PromptForm {
  category_id: number
  title: string
  content: string
  status: number
  variables: Record<string, string>
  tags: string[]
}

export function listPrompts(type: string, page = 1, pageSize = 20, keyword = '') {
  return client.get<ApiResponse<PagedResponse<Prompt>>, ApiResponse<PagedResponse<Prompt>>>(
    `/prompts?type=${type}&page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`,
  )
}

export function createPrompt(type: string, data: PromptForm) {
  return client.post<ApiResponse<Prompt>, ApiResponse<Prompt>>(`/prompts?type=${type}`, data)
}

export function updatePrompt(id: number, data: Partial<PromptForm>) {
  return client.put<ApiResponse<Prompt>, ApiResponse<Prompt>>(`/prompts/${id}`, data)
}

export function deletePrompt(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/prompts/${id}`)
}

export function publishPrompt(id: number) {
  return client.post<ApiResponse<Prompt>, ApiResponse<Prompt>>(`/prompts/${id}/publish`)
}

export interface PromptCategory {
  id: number
  name: string
  type: string
  description?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PromptCategoryForm {
  name: string
  description?: string
  sort_order: number
}

export function listPromptCategories(type: string, page = 1, pageSize = 20) {
  return client.get<
    ApiResponse<PagedResponse<PromptCategory>>,
    ApiResponse<PagedResponse<PromptCategory>>
  >(`/prompts/categories?type=${type}&page=${page}&page_size=${pageSize}`)
}

export function createPromptCategory(type: string, data: PromptCategoryForm) {
  return client.post<ApiResponse<PromptCategory>, ApiResponse<PromptCategory>>(
    `/prompts/categories?type=${type}`,
    data,
  )
}

export function updatePromptCategory(id: number, data: Partial<PromptCategoryForm>) {
  return client.put<ApiResponse<PromptCategory>, ApiResponse<PromptCategory>>(
    `/prompts/categories/${id}`,
    data,
  )
}

export function deletePromptCategory(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/prompts/categories/${id}`)
}

export interface PromptVersion {
  id: number
  prompt_id: number
  title: string
  content: string
  variables: Record<string, string>
  tags: string[]
  author_id: number
  created_at: string
}

export function listPromptVersions(id: number, page = 1, pageSize = 20) {
  return client.get<
    ApiResponse<PagedResponse<PromptVersion>>,
    ApiResponse<PagedResponse<PromptVersion>>
  >(`/prompts/${id}/versions?page=${page}&page_size=${pageSize}`)
}

export function rollbackPrompt(id: number, versionId: number) {
  return client.post<ApiResponse<Prompt>, ApiResponse<Prompt>>(`/prompts/${id}/rollback/${versionId}`)
}

export interface PromptPackageItem {
  id: number
  prompt_id: number
  sort_order: number
}

export interface PackageItemInput {
  prompt_id: number
  sort_order: number
}

export function listPackageItems(id: number) {
  return client.get<ApiResponse<PromptPackageItem[]>, ApiResponse<PromptPackageItem[]>>(
    `/prompts/${id}/package-items`,
  )
}

export function setPackageItems(id: number, items: PackageItemInput[]) {
  return client.post<ApiResponse<unknown>, ApiResponse<unknown>>(`/prompts/${id}/package-items`, {
    items,
  })
}
