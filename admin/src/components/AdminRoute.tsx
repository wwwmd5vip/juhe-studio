import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

/** Protect routes that require admin role (role >= 10). */
export default function AdminRoute() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.user?.role ?? 0)

  if (!token) return <Navigate to="/login" replace />
  if (role < 10) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
