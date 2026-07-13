import { client } from './client'
import type { ApiResponse } from '../types/api'

export interface LoginForm {
  username: string
  password: string
  captcha_id: string
  captcha_code: string
}

export interface LoginData {
  token: string
}

export interface CaptchaData {
  captcha_id: string
  image: string
}

export interface UserMe {
  id: number
  username: string
  email?: string
  role: number
  status: number
  group: string
  quota: number
  used_quota: number
  playground_trials_used: number
  created_at: string
  updated_at: string
}

export interface UpdatePasswordForm {
  old_password: string
  new_password: string
  confirm_password: string
}

export function login(data: LoginForm) {
  return client.post<ApiResponse<LoginData>, ApiResponse<LoginData>>('/auth/login', data)
}

export function getCaptcha() {
  return client.get<ApiResponse<CaptchaData>, ApiResponse<CaptchaData>>('/auth/captcha')
}

export function getMe() {
  return client.get<ApiResponse<UserMe>, ApiResponse<UserMe>>('/auth/me')
}

export function updatePassword(data: { old_password: string; new_password: string }) {
  return client.put<ApiResponse<unknown>, ApiResponse<unknown>>('/auth/password', data)
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  captcha_id: string
  captcha_code: string
}

export function register(data: RegisterForm) {
  return client.post<ApiResponse<{ message: string }>, ApiResponse<{ message: string }>>('/auth/register', data)
}

export function verifyEmail(code: string) {
  return client.get<ApiResponse<unknown>, ApiResponse<unknown>>('/auth/verify-email', { params: { code } })
}

export function verifyPassword(password: string) {
  return client.post<ApiResponse<{ valid: boolean }>, ApiResponse<{ valid: boolean }>>('/auth/verify-password', { password })
}

export function resendVerification(data: { email: string }) {
  return client.post<ApiResponse<{ message: string }>, ApiResponse<{ message: string }>>('/auth/resend-verification', data)
}
