import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface SubscriptionPlan {
  id: number
  name: string
  quota_value: number
  price_cents: number
  currency: string
  interval_months: number
  status: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SubscriptionPlanForm {
  name: string
  quota_value: number
  price_cents: number
  currency: string
  interval_months: number
  sort_order: number
}

export interface UserSubscription {
  id: number
  user_id: number
  plan_id: number
  status: number
  started_at: string
  expires_at: string
  last_billed_at?: string
  created_at: string
  updated_at: string
}

export function listSubscriptionPlans(page = 1, pageSize = 20) {
  return client.get<ApiResponse<PagedResponse<SubscriptionPlan>>, ApiResponse<PagedResponse<SubscriptionPlan>>>(
    `/subscriptions/plans?page=${page}&page_size=${pageSize}`,
  )
}

export function createSubscriptionPlan(data: SubscriptionPlanForm) {
  return client.post<ApiResponse<SubscriptionPlan>, ApiResponse<SubscriptionPlan>>('/subscriptions/plans', data)
}

export function listUserSubscriptions(page = 1, pageSize = 20, userId?: number) {
  let url = `/subscriptions?page=${page}&page_size=${pageSize}`
  if (userId) {
    url += `&user_id=${userId}`
  }
  return client.get<ApiResponse<PagedResponse<UserSubscription>>, ApiResponse<PagedResponse<UserSubscription>>>(url)
}

export function updateSubscriptionPlan(id: number, data: Partial<SubscriptionPlanForm> & { status?: number }) {
  return client.put<ApiResponse<SubscriptionPlan>, ApiResponse<SubscriptionPlan>>(`/subscriptions/plans/${id}`, data)
}

export function deleteSubscriptionPlan(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/subscriptions/plans/${id}`)
}

/** 为用户开通订阅 */
export function subscribeUser(userId: number, planId: number) {
  return client.post<ApiResponse<UserSubscription>, ApiResponse<UserSubscription>>('/subscriptions', {
    user_id: userId,
    plan_id: planId,
  })
}
