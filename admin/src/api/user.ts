import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'
import type { QuotaTransaction } from './quotaTransaction'
import type { UserSubscription } from './subscription'

export interface User {
  id: number
  username: string
  email?: string
  role: number
  status: number
  group: string
  quota: number
  used_quota: number
}

export interface UserCreateForm {
  username: string
  email?: string
  password: string
  role: number
  group?: string
}

export interface UserUpdateForm {
  email?: string
  role?: number
  status?: number
  group?: string
  quota?: number
}

export function listUsers(page = 1, pageSize = 20, keyword = '') {
  return client.get<ApiResponse<PagedResponse<User>>, ApiResponse<PagedResponse<User>>>(
    `/users?page=${page}&page_size=${pageSize}&keyword=${encodeURIComponent(keyword)}`,
  )
}

export function createUser(data: UserCreateForm) {
  return client.post<ApiResponse<User>, ApiResponse<User>>('/users', data)
}

export function updateUser(id: number, data: UserUpdateForm) {
  return client.put<ApiResponse<User>, ApiResponse<User>>(`/users/${id}`, data)
}

export function deleteUser(id: number) {
  return client.delete<ApiResponse<unknown>, ApiResponse<unknown>>(`/users/${id}`)
}

export function batchDeleteUsers(ids: number[]) {
  return client.post<ApiResponse<unknown>, ApiResponse<unknown>>('/users/batch-delete', { ids })
}

export function batchUpdateUserStatus(ids: number[], status: number) {
  return client.post<ApiResponse<unknown>, ApiResponse<unknown>>('/users/batch-status', { ids, status })
}

/** 调整用户额度（可正可负） */
export function adjustUserQuota(id: number, amount: number, description?: string) {
  return client.post<ApiResponse<User>, ApiResponse<User>>(`/users/${id}/quota`, { amount, description })
}

/** 管理员重置用户密码 */
export function setUserPassword(id: number, password: string) {
  return client.put<ApiResponse<unknown>, ApiResponse<unknown>>(`/users/${id}/password`, { password })
}

// Reserved for future use
// /** 获取单个用户详情 */
// export function getUser(id: number) {
//   return client.get<ApiResponse<User>, ApiResponse<User>>(`/users/${id}`)
// }

/** 获取所有分组列表 */
export function listGroups() {
  return client.get<ApiResponse<string[]>, ApiResponse<string[]>>('/channels/groups')
}

export interface UserFinanceData {
  quota: number
  used_quota: number
  today_requests: number
  today_tokens: number
  today_consumed: number
  trends: { date: string; consumed: number }[]
  recent_transactions: QuotaTransaction[]
  subscriptions: UserSubscription[]
}

export function getUserFinance(userId: number) {
  return client.get<ApiResponse<UserFinanceData>>(`/users/${userId}/finance`)
}
