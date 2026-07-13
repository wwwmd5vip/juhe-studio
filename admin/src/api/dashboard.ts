import { client } from './client'
import type { ApiResponse } from '../types/api'

export interface DashboardStats {
  user_count: number
  token_count: number
  channel_count: number
  active_channel_count: number
  model_count: number
  today_request_count: number
  today_token_count: number
  today_quota_consumed: number
  today_quota_recharged: number
  month_quota_consumed: number
  error_channel_count: number
}

export interface DashboardTrendItem {
  date: string
  requests: number
  quota: number
}

export function getDashboardStats() {
  return client.get<ApiResponse<DashboardStats>, ApiResponse<DashboardStats>>('/dashboard/stats')
}

export function getDashboardTrends(days = 30) {
  return client.get<ApiResponse<DashboardTrendItem[]>, ApiResponse<DashboardTrendItem[]>>('/dashboard/trends', {
    params: { days },
  })
}

export interface ModelCapabilityStats {
  [key: string]: number
}

export function getModelCapabilityStats() {
  return client.get<ApiResponse<ModelCapabilityStats>, ApiResponse<ModelCapabilityStats>>(
    '/dashboard/model-capability-stats',
  )
}

// --- Phase 1.1 additions ---

export interface UsageHeatmapItem {
  hour: number
  model_name: string
  count: number
}

export function getUsageHeatmap(days = 7) {
  return client.get<ApiResponse<UsageHeatmapItem[]>, ApiResponse<UsageHeatmapItem[]>>(
    '/dashboard/usage-heatmap',
    { params: { days } },
  )
}

export interface TopUserItem {
  user_id: number
  username: string
  quota_consumed: number
  request_count: number
}

export function getTopUsers(days = 30, limit = 10) {
  return client.get<ApiResponse<TopUserItem[]>, ApiResponse<TopUserItem[]>>('/dashboard/top-users', {
    params: { days, limit },
  })
}

export interface TopTokenItem {
  token_id: number
  name: string
  key_mask: string
  quota_consumed: number
  request_count: number
}

export function getTopTokens(days = 30, limit = 10) {
  return client.get<ApiResponse<TopTokenItem[]>, ApiResponse<TopTokenItem[]>>('/dashboard/top-tokens', {
    params: { days, limit },
  })
}

// --- Task 1.2 additions ---

export interface ErrorRateChannelItem {
  channel_id: number
  channel_name: string
  type: string
  total_requests: number
  error_count: number
  error_rate: number
}

export interface ErrorRateModelItem {
  model_name: string
  total_requests: number
  error_count: number
  error_rate: number
}

export interface ErrorRateResponse {
  channels: ErrorRateChannelItem[]
  models: ErrorRateModelItem[]
}

export function getErrorRate(days = 7) {
  return client.get<ApiResponse<ErrorRateResponse>, ApiResponse<ErrorRateResponse>>(
    '/dashboard/error-rate',
    { params: { days } },
  )
}

export interface QuotaForecastItem {
  date: string
  predicted_quota: number
}

export function getQuotaForecast(userId?: number, days = 30) {
  const params: Record<string, string | number> = { days }
  if (userId) params.user_id = userId
  return client.get<ApiResponse<QuotaForecastItem[]>, ApiResponse<QuotaForecastItem[]>>(
    '/dashboard/quota-forecast',
    { params },
  )
}
