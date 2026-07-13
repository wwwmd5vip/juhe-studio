import { useCallback } from 'react'
import { useAuthStore } from '../stores/authStore'

export function useAuth() {
  const { token, setToken, logout } = useAuthStore()

  const login = useCallback(
    (newToken: string) => {
      setToken(newToken)
    },
    [setToken],
  )

  const signOut = useCallback(() => {
    logout()
  }, [logout])

  return {
    token,
    login,
    logout: signOut,
    isAuthenticated: !!token,
  }
}
