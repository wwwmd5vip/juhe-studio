import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { useShortcuts } from '@/hooks/useShortcuts'

export const Route = createRootRoute({
  component: RootComponent
})

function RootComponent() {
  useShortcuts()
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
