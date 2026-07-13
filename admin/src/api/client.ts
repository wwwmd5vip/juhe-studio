import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../stores/authStore'

export const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

client.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('juhe_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // localStorage unavailable (e.g., incognito), skip token
  }
  return config
})

client.interceptors.response.use(
  (res) => res.data,
  (err: AxiosError<{ code: number; message: string }>) => {
    // Don't redirect on login/register failures — let the caller handle the error
    const isAuthEndpoint = err.config?.url?.startsWith('/auth/login') || err.config?.url?.startsWith('/auth/register')
    if (err.response?.status === 401 && !isAuthEndpoint) {
      try { localStorage.removeItem('juhe_token') } catch { /* ignore */ }
      // Clear auth state via Zustand store before redirecting
      useAuthStore.getState().logout()
      // Don't navigate — ProtectedRoute will redirect when auth state clears
    }
    const msg = err.response?.data?.message || err.message
    return Promise.reject(new Error(msg))
  },
)
