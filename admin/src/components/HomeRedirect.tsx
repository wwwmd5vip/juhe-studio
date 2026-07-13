import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

/** Redirect to appropriate landing page based on user role. */
export default function HomeRedirect() {
  const role = useAuthStore((s) => s.user?.role ?? 0)
  return <Navigate to={role >= 10 ? '/admin' : '/dashboard'} replace />
}
