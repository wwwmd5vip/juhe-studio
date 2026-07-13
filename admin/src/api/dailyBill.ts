import { client } from './client'
import type { ApiResponse, PagedResponse } from '../types/api'

export interface DailyBill {
  id: number
  bill_date: string
  user_id: number
  model_name: string
  request_count: number
  token_count: number
  quota_consumed: number
  quota_recharged: number
  created_at: string
  updated_at: string
}

export interface MonthlyBill {
  month: string
  request_count: number
  token_count: number
  quota_consumed: number
  quota_recharged: number
}

export function listDailyBills(
  page = 1,
  pageSize = 20,
  startDate: string,
  endDate: string,
  userId?: number,
) {
  let url = `/daily-bills?page=${page}&page_size=${pageSize}&start_date=${encodeURIComponent(
    startDate,
  )}&end_date=${encodeURIComponent(endDate)}`
  if (userId) {
    url += `&user_id=${userId}`
  }
  return client.get<ApiResponse<PagedResponse<DailyBill>>, ApiResponse<PagedResponse<DailyBill>>>(url)
}

export function listMonthlyBills(startMonth: string, endMonth: string, userId?: number) {
  let url = `/daily-bills/monthly?start_month=${encodeURIComponent(startMonth)}&end_month=${encodeURIComponent(
    endMonth,
  )}`
  if (userId) {
    url += `&user_id=${userId}`
  }
  return client.get<ApiResponse<PagedResponse<MonthlyBill>>, ApiResponse<PagedResponse<MonthlyBill>>>(url)
}

export function aggregateDailyBills(date: string) {
  return client.post<ApiResponse<unknown>, ApiResponse<unknown>>(
    `/daily-bills/aggregate?date=${encodeURIComponent(date)}`,
  )
}
