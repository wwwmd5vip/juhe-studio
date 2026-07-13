import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface Feedback {
  id: number
  type: 'bug' | 'feature' | 'other'
  title: string
  content: string
  contact: string
  app_version: string
  os: string
  created_at: string
}

export interface FeedbackFilter {
  type?: string
  start_date?: string
  end_date?: string
}

export function listFeedbacks(page = 1, pageSize = 20, filter: FeedbackFilter = {}) {
  let url = `/feedbacks?page=${page}&page_size=${pageSize}`
  if (filter.type) {
    url += `&type=${encodeURIComponent(filter.type)}`
  }
  if (filter.start_date) {
    url += `&start_date=${encodeURIComponent(filter.start_date)}`
  }
  if (filter.end_date) {
    url += `&end_date=${encodeURIComponent(filter.end_date)}`
  }
  return client.get<ApiResponse<PagedResponse<Feedback>>, ApiResponse<PagedResponse<Feedback>>>(url)
}

export function deleteFeedback(id: number) {
  return client.delete<ApiResponse, ApiResponse>(`/feedbacks/${id}`)
}
